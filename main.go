package main

import (
    "crypto/rand"
    "encoding/hex"
    "encoding/json"
    "errors"
    "fmt"
    "log"
    "math/big"
    "net/http"
    "os"
    "path/filepath"
    "sort"
    "strings"
    "sync"
    "time"
)

// Basic types per SPEC
type Board struct {
    ID           string  `json:"id"`
    Name         string  `json:"name"`
    Description  *string `json:"description"`
    Owner        string  `json:"owner"`
    CreatedAt    string  `json:"createdAt"`
    UpdatedAt    string  `json:"updatedAt"`
    MyRole       string  `json:"myRole"`
    MembersCount int     `json:"membersCount"`
}

type Column struct {
    ID        string `json:"id"`
    BoardID   string `json:"boardId"`
    Name      string `json:"name"`
    SortKey   string `json:"sortKey"`
    CreatedAt string `json:"createdAt"`
    UpdatedAt string `json:"updatedAt"`
}

type Card struct {
    ID        string  `json:"id"`
    BoardID   string  `json:"boardId"`
    ColumnID  string  `json:"columnId"`
    Title     string  `json:"title"`
    Desc      *string `json:"description"`
    SortKey   string  `json:"sortKey"`
    CreatedAt string  `json:"createdAt"`
    UpdatedAt string  `json:"updatedAt"`
    Version   int     `json:"version"`
}

type UserSummary struct {
    ID          string  `json:"id"`
    DisplayName string  `json:"displayName"`
    AvatarURL   *string `json:"avatarUrl"`
}

type Membership struct {
    BoardID   string       `json:"boardId"`
    UserID    string       `json:"userId"`
    Role      string       `json:"role"`
    Status    string       `json:"status"`
    InvitedBy string       `json:"invitedBy"`
    CreatedAt string       `json:"createdAt"`
    UpdatedAt string       `json:"updatedAt"`
    User      *UserSummary `json:"user"`
}

type Invitation struct {
    ID      string  `json:"id"`
    BoardID string  `json:"boardId"`
    Email   *string `json:"email"`
    Role    string  `json:"role"`
    Status  string  `json:"status"`
    Token   string  `json:"token"`
}

// In-memory store
type Store struct {
    mu           sync.RWMutex
    boards       map[string]*BoardRec
    columns      map[string]*ColumnRec
    cards        map[string]*CardRec
    memberships  map[string]map[string]*Membership // by boardId -> userId
    invitations  map[string]*Invitation
    idempo       map[string]*CachedResponse
}

type BoardRec struct {
    ID           string
    Name         string
    Description  *string
    Owner        string
    CreatedAt    time.Time
    UpdatedAt    time.Time
}
type ColumnRec struct {
    ID        string
    BoardID   string
    Name      string
    SortKey   string
    CreatedAt time.Time
    UpdatedAt time.Time
}
type CardRec struct {
    ID        string
    BoardID   string
    ColumnID  string
    Title     string
    Desc      *string
    SortKey   string
    Version   int
    CreatedAt time.Time
    UpdatedAt time.Time
}

type CachedResponse struct {
    Status int
    Body   []byte
    CT     string
}

var store = &Store{
    boards:      make(map[string]*BoardRec),
    columns:     make(map[string]*ColumnRec),
    cards:       make(map[string]*CardRec),
    memberships: make(map[string]map[string]*Membership),
    invitations: make(map[string]*Invitation),
    idempo:      make(map[string]*CachedResponse),
}

func nowISO() string { return time.Now().UTC().Format(time.RFC3339Nano) }

// UUID v4
func uuidv4() string {
    b := make([]byte, 16)
    _, _ = rand.Read(b)
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    // format 8-4-4-4-12
    s := hex.EncodeToString(b)
    return fmt.Sprintf("%s-%s-%s-%s-%s", s[0:8], s[8:12], s[12:16], s[16:20], s[20:32])
}

// LexoRank midpoint per spec
var lexoAlphabet = []rune("0123456789abcdefghijklmnopqrstuvwxyz")
var a2i = func() map[rune]int {
    m := map[rune]int{}
    for i, ch := range lexoAlphabet {
        m[ch] = i
    }
    return m
}()

func lexoMid(left, right *string) string {
    var L, R string
    if left != nil { L = *left }
    if right != nil { R = *right }
    i := 0
    out := make([]rune, 0, 8)
    for {
        var l, r int
        if i < len(L) { l = a2i[rune(L[i])] } else { l = 0 }
        if i < len(R) { r = a2i[rune(R[i])] } else { r = 35 }
        if l+1 < r {
            mid := (l + r) / 2
            out = append(out, lexoAlphabet[mid])
            return string(out)
        }
        out = append(out, lexoAlphabet[l])
        i++
    }
}

// Helpers
func trimNonEmpty(s string) (string, bool) {
    t := strings.TrimSpace(s)
    if t == "" { return "", false }
    return t, true
}

func writeJSON(w http.ResponseWriter, r *http.Request, status int, v any) {
    w.Header().Set("Content-Type", "application/json; charset=utf-8")
    if rid := r.Header.Get("X-Request-Id"); rid != "" {
        w.Header().Set("X-Request-Id", rid)
    }
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, r *http.Request, status int, code, message string, details map[string]string) {
    if details == nil { details = map[string]string{} }
    rid := r.Header.Get("X-Request-Id")
    writeJSON(w, r, status, map[string]any{
        "error": map[string]any{
            "code": code,
            "message": message,
            "details": details,
            "requestId": rid,
        },
    })
}

func getUserID(r *http.Request) (string, error) {
    auth := r.Header.Get("Authorization")
    if !strings.HasPrefix(auth, "Bearer ") {
        return "", errors.New("missing_bearer")
    }
    token := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
    if token == "" {
        return "", errors.New("invalid_token")
    }
    // Treat token itself as userId for this demo
    return token, nil
}

// Idempotency cache
func withIdempotency(w http.ResponseWriter, r *http.Request, handler func() (int, any, string)) {
    key := r.Header.Get("Idempotency-Key")
    if key != "" {
        store.mu.RLock()
        if c, ok := store.idempo[key]; ok {
            store.mu.RUnlock()
            w.Header().Set("Content-Type", c.CT)
            if rid := r.Header.Get("X-Request-Id"); rid != "" {
                w.Header().Set("X-Request-Id", rid)
            }
            w.WriteHeader(c.Status)
            _, _ = w.Write(c.Body)
            return
        }
        store.mu.RUnlock()
    }

    status, body, ct := handler()

    // encode body now to cache raw bytes
    buf, _ := json.Marshal(body)
    if ct == "" { ct = "application/json; charset=utf-8" }
    if key != "" {
        store.mu.Lock()
        store.idempo[key] = &CachedResponse{Status: status, Body: buf, CT: ct}
        store.mu.Unlock()
    }
    w.Header().Set("Content-Type", ct)
    if rid := r.Header.Get("X-Request-Id"); rid != "" {
        w.Header().Set("X-Request-Id", rid)
    }
    w.WriteHeader(status)
    _, _ = w.Write(buf)
}

// Sorting helpers
func listColumnsSorted(boardID string) []*ColumnRec {
    store.mu.RLock()
    defer store.mu.RUnlock()
    cols := []*ColumnRec{}
    for _, c := range store.columns {
        if c.BoardID == boardID { cols = append(cols, c) }
    }
    sort.Slice(cols, func(i, j int) bool {
        if cols[i].SortKey == cols[j].SortKey {
            if cols[i].CreatedAt.Equal(cols[j].CreatedAt) { return cols[i].ID < cols[j].ID }
            return cols[i].CreatedAt.Before(cols[j].CreatedAt)
        }
        return cols[i].SortKey < cols[j].SortKey
    })
    return cols
}

func listCardsSorted(boardID, columnID string) []*CardRec {
    store.mu.RLock()
    defer store.mu.RUnlock()
    cards := []*CardRec{}
    for _, c := range store.cards {
        if c.BoardID == boardID && c.ColumnID == columnID { cards = append(cards, c) }
    }
    sort.Slice(cards, func(i, j int) bool {
        if cards[i].SortKey == cards[j].SortKey {
            if cards[i].CreatedAt.Equal(cards[j].CreatedAt) { return cards[i].ID < cards[j].ID }
            return cards[i].CreatedAt.Before(cards[j].CreatedAt)
        }
        return cards[i].SortKey < cards[j].SortKey
    })
    return cards
}

// HTTP Handlers
func handleHealth(w http.ResponseWriter, r *http.Request) {
    writeJSON(w, r, 200, map[string]string{"status": "ok"})
}

func handleVersion(w http.ResponseWriter, r *http.Request) {
    writeJSON(w, r, 200, map[string]string{"version": "1.0.0"})
}

// Boards
func handleCreateBoard(w http.ResponseWriter, r *http.Request) {
    uid, err := getUserID(r)
    if err != nil { writeError(w, r, 401, "unauthorized", "Authorization required", nil); return }
    type Req struct{ Name string `json:"name"`; Description *string `json:"description"` }
    var req Req
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, r, 400, "bad_request", "Invalid JSON", nil); return }
    name, ok := trimNonEmpty(req.Name)
    if !ok || len(name) > 140 { writeError(w, r, 422, "validation_error", "name must be 1..140", map[string]string{"name":"required_non_empty"}); return }

    withIdempotency(w, r, func() (int, any, string) {
        id := uuidv4()
        now := time.Now().UTC()
        br := &BoardRec{ID: id, Name: name, Description: req.Description, Owner: uid, CreatedAt: now, UpdatedAt: now}
        store.mu.Lock()
        store.boards[id] = br
        // initialize membership map
        if _, ok := store.memberships[id]; !ok { store.memberships[id] = map[string]*Membership{} }
        store.mu.Unlock()

        b := Board{ID: id, Name: name, Description: req.Description, Owner: uid, CreatedAt: br.CreatedAt.Format(time.RFC3339Nano), UpdatedAt: br.UpdatedAt.Format(time.RFC3339Nano), MyRole: "admin", MembersCount: 1}
        return 201, b, "application/json; charset=utf-8"
    })
}

func handleListBoards(w http.ResponseWriter, r *http.Request) {
    uid, err := getUserID(r)
    if err != nil { writeError(w, r, 401, "unauthorized", "Authorization required", nil); return }
    // Simple list of boards where user is owner or member
    type Item struct {
        ID           string  `json:"id"`
        Name         string  `json:"name"`
        Description  *string `json:"description"`
        Owner        string  `json:"owner"`
        CreatedAt    string  `json:"createdAt"`
        UpdatedAt    string  `json:"updatedAt"`
        MyRole       string  `json:"myRole"`
        MembersCount int     `json:"membersCount"`
    }
    res := struct {
        Boards     []Item  `json:"boards"`
        NextCursor *string `json:"nextCursor"`
    }{Boards: []Item{}, NextCursor: nil}

    store.mu.RLock()
    for _, b := range store.boards {
        role := ""
        if b.Owner == uid { role = "admin" }
        if role == "" {
            if m, ok := store.memberships[b.ID]; ok {
                if mem, ok2 := m[uid]; ok2 {
                    role = mem.Role
                }
            }
        }
        if role == "" { continue }
        count := 1 // owner
        if m, ok := store.memberships[b.ID]; ok { count += len(m) }
        res.Boards = append(res.Boards, Item{
            ID: b.ID, Name: b.Name, Description: b.Description, Owner: b.Owner,
            CreatedAt: b.CreatedAt.Format(time.RFC3339Nano), UpdatedAt: b.UpdatedAt.Format(time.RFC3339Nano),
            MyRole: role, MembersCount: count,
        })
    }
    store.mu.RUnlock()
    writeJSON(w, r, 200, res)
}

func handleGetBoard(w http.ResponseWriter, r *http.Request, boardID string) {
    uid, err := getUserID(r)
    if err != nil { writeError(w, r, 401, "unauthorized", "Authorization required", nil); return }
    store.mu.RLock()
    b := store.boards[boardID]
    store.mu.RUnlock()
    if b == nil { writeError(w, r, 404, "not_found", "Board not found", nil); return }
    role := ""
    if b.Owner == uid { role = "admin" } else {
        store.mu.RLock()
        if m, ok := store.memberships[boardID]; ok {
            if mem, ok2 := m[uid]; ok2 { role = mem.Role }
        }
        store.mu.RUnlock()
    }
    if role == "" { writeError(w, r, 403, "forbidden", "Not a member", nil); return }

    cols := listColumnsSorted(boardID)
    cards := []*CardRec{}
    for _, c := range cols {
        cards = append(cards, listCardsSorted(boardID, c.ID)...)
    }
    // Build response
    count := 1
    store.mu.RLock()
    if m, ok := store.memberships[boardID]; ok { count += len(m) }
    store.mu.RUnlock()
    board := Board{ID: b.ID, Name: b.Name, Description: b.Description, Owner: b.Owner, CreatedAt: b.CreatedAt.Format(time.RFC3339Nano), UpdatedAt: b.UpdatedAt.Format(time.RFC3339Nano), MyRole: role, MembersCount: count}
    outCols := make([]Column, 0, len(cols))
    for _, c := range cols {
        outCols = append(outCols, Column{ID: c.ID, BoardID: c.BoardID, Name: c.Name, SortKey: c.SortKey, CreatedAt: c.CreatedAt.Format(time.RFC3339Nano), UpdatedAt: c.UpdatedAt.Format(time.RFC3339Nano)})
    }
    outCards := make([]Card, 0, len(cards))
    for _, c := range cards {
        outCards = append(outCards, Card{ID: c.ID, BoardID: c.BoardID, ColumnID: c.ColumnID, Title: c.Title, Desc: c.Desc, SortKey: c.SortKey, CreatedAt: c.CreatedAt.Format(time.RFC3339Nano), UpdatedAt: c.UpdatedAt.Format(time.RFC3339Nano), Version: c.Version})
    }
    writeJSON(w, r, 200, map[string]any{"board": board, "columns": outCols, "cards": outCards})
}

func anchorsToKeys[T any](ids []T, idToKey func(T) (string, bool), beforeID *T, afterID *T) (*string, *string, error) {
    var left, right *string
    if beforeID != nil {
        if key, ok := idToKey(*beforeID); ok { right = &key } else { return nil, nil, errors.New("before_not_found") }
    }
    if afterID != nil {
        if key, ok := idToKey(*afterID); ok { left = &key } else { return nil, nil, errors.New("after_not_found") }
    }
    return left, right, nil
}

func handleCreateColumn(w http.ResponseWriter, r *http.Request, boardID string) {
    uid, err := getUserID(r)
    if err != nil { writeError(w, r, 401, "unauthorized", "Authorization required", nil); return }
    // must have writer/admin rights; owner is admin
    store.mu.RLock()
    b := store.boards[boardID]
    store.mu.RUnlock()
    if b == nil { writeError(w, r, 404, "not_found", "Board not found", nil); return }
    role := ""
    if b.Owner == uid { role = "admin" } else {
        store.mu.RLock(); if m, ok := store.memberships[boardID]; ok { if mem, ok2 := m[uid]; ok2 { role = mem.Role } }; store.mu.RUnlock()
    }
    if role == "reader" || role == "" { writeError(w, r, 403, "forbidden", "Insufficient permissions", nil); return }

    var req struct {
        Name           string  `json:"name"`
        BeforeColumnID *string `json:"beforeColumnId"`
        AfterColumnID  *string `json:"afterColumnId"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, r, 400, "bad_request", "Invalid JSON", nil); return }
    name, ok := trimNonEmpty(req.Name)
    if !ok || len(name) > 80 { writeError(w, r, 422, "validation_error", "name must be 1..80", map[string]string{"name":"required_non_empty"}); return }

    withIdempotency(w, r, func() (int, any, string) {
        cols := listColumnsSorted(boardID)
        var left, right *string
        if req.BeforeColumnID != nil || req.AfterColumnID != nil {
            idToKey := func(id string) (string, bool) {
                for _, c := range cols { if c.ID == id { return c.SortKey, true } }
                return "", false
            }
            l, rgt, aerr := anchorsToKeys(cols, idToKey, req.BeforeColumnID, req.AfterColumnID)
            if aerr != nil { return 422, map[string]any{"error": map[string]any{"code": "validation_error", "message": "Invalid anchors"}}, "application/json; charset=utf-8" }
            left, right = l, rgt
        }
        if req.BeforeColumnID == nil && req.AfterColumnID == nil {
            // insert at end: left = last, right = None
            if len(cols) > 0 { last := cols[len(cols)-1].SortKey; left = &last }
        }
        sk := lexoMid(left, right)
        id := uuidv4(); now := time.Now().UTC()
        cr := &ColumnRec{ID: id, BoardID: boardID, Name: name, SortKey: sk, CreatedAt: now, UpdatedAt: now}
        store.mu.Lock(); store.columns[id] = cr; store.mu.Unlock()
        c := Column{ID: id, BoardID: boardID, Name: name, SortKey: sk, CreatedAt: now.Format(time.RFC3339Nano), UpdatedAt: now.Format(time.RFC3339Nano)}
        return 201, c, "application/json; charset=utf-8"
    })
}

func handleMoveColumn(w http.ResponseWriter, r *http.Request, boardID, columnID string) {
    uid, err := getUserID(r)
    if err != nil { writeError(w, r, 401, "unauthorized", "Authorization required", nil); return }
    store.mu.RLock(); b := store.boards[boardID]; store.mu.RUnlock()
    if b == nil { writeError(w, r, 404, "not_found", "Board not found", nil); return }
    role := ""
    if b.Owner == uid { role = "admin" } else { store.mu.RLock(); if m, ok := store.memberships[boardID]; ok { if mem, ok2 := m[uid]; ok2 { role = mem.Role } }; store.mu.RUnlock() }
    if role == "reader" || role == "" { writeError(w, r, 403, "forbidden", "Insufficient permissions", nil); return }

    var req struct { BeforeColumnID *string `json:"beforeColumnId"`; AfterColumnID *string `json:"afterColumnId"` }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, r, 400, "bad_request", "Invalid JSON", nil); return }

    cols := listColumnsSorted(boardID)
    // verify column exists and belongs to board
    var target *ColumnRec
    for _, c := range cols { if c.ID == columnID { target = c; break } }
    if target == nil { writeError(w, r, 404, "not_found", "Column not found", nil); return }

    var left, right *string
    if req.BeforeColumnID == nil && req.AfterColumnID == nil {
        // end
        if len(cols) > 0 { last := cols[len(cols)-1].SortKey; left = &last }
    } else {
        idToKey := func(id string) (string, bool) { for _, c := range cols { if c.ID == id { return c.SortKey, true } }; return "", false }
        l, rgt, aerr := anchorsToKeys(cols, idToKey, req.BeforeColumnID, req.AfterColumnID)
        if aerr != nil { writeError(w, r, 422, "validation_error", "Invalid anchors", nil); return }
        left, right = l, rgt
    }
    sk := lexoMid(left, right)
    store.mu.Lock(); if c := store.columns[columnID]; c != nil { c.SortKey, c.UpdatedAt = sk, time.Now().UTC() }; store.mu.Unlock()
    writeJSON(w, r, 200, map[string]string{"status":"ok"})
}

func handleCreateCard(w http.ResponseWriter, r *http.Request, boardID, columnID string) {
    uid, err := getUserID(r)
    if err != nil { writeError(w, r, 401, "unauthorized", "Authorization required", nil); return }
    store.mu.RLock(); b := store.boards[boardID]; store.mu.RUnlock()
    if b == nil { writeError(w, r, 404, "not_found", "Board not found", nil); return }
    role := ""
    if b.Owner == uid { role = "admin" } else { store.mu.RLock(); if m, ok := store.memberships[boardID]; ok { if mem, ok2 := m[uid]; ok2 { role = mem.Role } }; store.mu.RUnlock() }
    if role == "reader" || role == "" { writeError(w, r, 403, "forbidden", "Insufficient permissions", nil); return }
    store.mu.RLock(); col := store.columns[columnID]; store.mu.RUnlock()
    if col == nil || col.BoardID != boardID { writeError(w, r, 404, "not_found", "Column not found", nil); return }

    var req struct {
        Title        string  `json:"title"`
        Description  *string `json:"description"`
        BeforeCardID *string `json:"beforeCardId"`
        AfterCardID  *string `json:"afterCardId"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, r, 400, "bad_request", "Invalid JSON", nil); return }
    title, ok := trimNonEmpty(req.Title)
    if !ok || len(title) > 200 { writeError(w, r, 422, "validation_error", "title must be 1..200", map[string]string{"title":"required_non_empty"}); return }

    withIdempotency(w, r, func() (int, any, string) {
        cards := listCardsSorted(boardID, columnID)
        var left, right *string
        if req.BeforeCardID == nil && req.AfterCardID == nil {
            if len(cards) > 0 { last := cards[len(cards)-1].SortKey; left = &last }
        } else {
            idToKey := func(id string) (string, bool) { for _, c := range cards { if c.ID == id { return c.SortKey, true } }; return "", false }
            l, rgt, aerr := anchorsToKeys(cards, idToKey, req.BeforeCardID, req.AfterCardID)
            if aerr != nil { return 422, map[string]any{"error": map[string]any{"code":"validation_error","message":"Invalid anchors"}}, "application/json; charset=utf-8" }
            left, right = l, rgt
        }
        sk := lexoMid(left, right)
        id := uuidv4(); now := time.Now().UTC()
        rec := &CardRec{ID: id, BoardID: boardID, ColumnID: columnID, Title: title, Desc: req.Description, SortKey: sk, Version: 0, CreatedAt: now, UpdatedAt: now}
        store.mu.Lock(); store.cards[id] = rec; store.mu.Unlock()
        out := Card{ID: id, BoardID: boardID, ColumnID: columnID, Title: title, Desc: req.Description, SortKey: sk, CreatedAt: now.Format(time.RFC3339Nano), UpdatedAt: now.Format(time.RFC3339Nano), Version: 0}
        return 201, out, "application/json; charset=utf-8"
    })
}

func handleMoveCard(w http.ResponseWriter, r *http.Request, boardID, cardID string) {
    uid, err := getUserID(r)
    if err != nil { writeError(w, r, 401, "unauthorized", "Authorization required", nil); return }
    store.mu.RLock(); b := store.boards[boardID]; store.mu.RUnlock()
    if b == nil { writeError(w, r, 404, "not_found", "Board not found", nil); return }
    role := ""
    if b.Owner == uid { role = "admin" } else { store.mu.RLock(); if m, ok := store.memberships[boardID]; ok { if mem, ok2 := m[uid]; ok2 { role = mem.Role } }; store.mu.RUnlock() }
    if role == "reader" || role == "" { writeError(w, r, 403, "forbidden", "Insufficient permissions", nil); return }

    var req struct {
        ToColumnID   *string `json:"toColumnId"`
        BeforeCardID *string `json:"beforeCardId"`
        AfterCardID  *string `json:"afterCardId"`
        ExpectedVer  *int    `json:"expectedVersion"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, r, 400, "bad_request", "Invalid JSON", nil); return }
    store.mu.RLock(); rec := store.cards[cardID]; store.mu.RUnlock()
    if rec == nil || rec.BoardID != boardID { writeError(w, r, 404, "not_found", "Card not found", nil); return }
    if req.ExpectedVer != nil && *req.ExpectedVer != rec.Version { writeError(w, r, 412, "precondition_failed", "Stale version", nil); return }
    targetCol := rec.ColumnID
    if req.ToColumnID != nil { targetCol = *req.ToColumnID }
    store.mu.RLock(); tc := store.columns[targetCol]; store.mu.RUnlock()
    if tc == nil { writeError(w, r, 422, "invalid_move", "Target column not found", nil); return }
    if tc.BoardID != rec.BoardID { writeError(w, r, 409, "invalid_move", "Card can be moved only within the same board.", nil); return }

    cards := listCardsSorted(boardID, targetCol)
    var left, right *string
    if req.BeforeCardID == nil && req.AfterCardID == nil {
        if len(cards) > 0 { last := cards[len(cards)-1].SortKey; left = &last }
    } else {
        idToKey := func(id string) (string, bool) { for _, c := range cards { if c.ID == id { return c.SortKey, true } }; return "", false }
        l, rgt, aerr := anchorsToKeys(cards, idToKey, req.BeforeCardID, req.AfterCardID)
        if aerr != nil { writeError(w, r, 422, "validation_error", "Invalid anchors", nil); return }
        left, right = l, rgt
    }
    sk := lexoMid(left, right)

    store.mu.Lock()
    if req.ToColumnID != nil { rec.ColumnID = targetCol }
    rec.SortKey = sk
    rec.Version += 1
    rec.UpdatedAt = time.Now().UTC()
    store.mu.Unlock()
    writeJSON(w, r, 200, map[string]any{"status":"ok", "version": rec.Version})
}

func handleInviteMember(w http.ResponseWriter, r *http.Request, boardID string) {
    uid, err := getUserID(r)
    if err != nil { writeError(w, r, 401, "unauthorized", "Authorization required", nil); return }
    store.mu.RLock(); b := store.boards[boardID]; store.mu.RUnlock()
    if b == nil { writeError(w, r, 404, "not_found", "Board not found", nil); return }
    if b.Owner != uid { writeError(w, r, 403, "forbidden", "Only owner/admin may invite", nil); return }

    var req struct { Email *string `json:"email"`; UserID *string `json:"userId"`; Role string `json:"role"` }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, r, 400, "bad_request", "Invalid JSON", nil); return }
    if req.Role != "admin" && req.Role != "writer" && req.Role != "reader" { writeError(w, r, 422, "validation_error", "Invalid role", map[string]string{"role":"invalid"}); return }
    if req.Email == nil && req.UserID == nil { writeError(w, r, 422, "validation_error", "email or userId required", map[string]string{"target":"required"}); return }

    withIdempotency(w, r, func() (int, any, string) {
        id := uuidv4(); token := uuidv4(); now := nowISO()
        inv := &Invitation{ID: id, BoardID: boardID, Email: req.Email, Role: req.Role, Status: "pending", Token: token}
        store.mu.Lock()
        store.invitations[id] = inv
        if _, ok := store.memberships[boardID]; !ok { store.memberships[boardID] = map[string]*Membership{} }
        // create membership if userId provided
        if req.UserID != nil {
            store.memberships[boardID][*req.UserID] = &Membership{BoardID: boardID, UserID: *req.UserID, Role: req.Role, Status: "pending", InvitedBy: uid, CreatedAt: now, UpdatedAt: now, User: &UserSummary{ID: *req.UserID, DisplayName: *req.UserID, AvatarURL: nil}}
        }
        store.mu.Unlock()
        return 201, map[string]any{"membership": map[string]any{"boardId": boardID, "role": req.Role, "status": "pending"}, "invitation": inv}, "application/json; charset=utf-8"
    })
}

// Simple router
func router(w http.ResponseWriter, r *http.Request) {
    if strings.HasPrefix(r.URL.Path, "/v1/") {
        apiRouter(w, r)
        return
    }
    // static files
    if r.URL.Path == "/" {
        http.ServeFile(w, r, filepath.Join("web", "index.html"))
        return
    }
    http.StripPrefix("/", http.FileServer(http.Dir("web"))).ServeHTTP(w, r)
}

func apiRouter(w http.ResponseWriter, r *http.Request) {
    path := strings.TrimPrefix(r.URL.Path, "/v1")
    switch {
    case path == "/health" && r.Method == http.MethodGet:
        handleHealth(w, r)
        return
    case path == "/version" && r.Method == http.MethodGet:
        handleVersion(w, r)
        return
    case path == "/boards" && r.Method == http.MethodPost:
        handleCreateBoard(w, r)
        return
    case path == "/boards" && r.Method == http.MethodGet:
        handleListBoards(w, r)
        return
    }

    // /boards/{id}
    seg := strings.Split(strings.Trim(path, "/"), "/")
    // seg[0]=="boards"
    if len(seg) >= 2 && seg[0] == "boards" {
        boardID := seg[1]
        if len(seg) == 2 && r.Method == http.MethodGet {
            handleGetBoard(w, r, boardID)
            return
        }
        if len(seg) >= 3 && seg[2] == "members" && r.Method == http.MethodPost {
            handleInviteMember(w, r, boardID)
            return
        }
        if len(seg) >= 3 && seg[2] == "columns" {
            if len(seg) == 3 && r.Method == http.MethodPost {
                handleCreateColumn(w, r, boardID)
                return
            }
            if len(seg) == 4 {
                colID := seg[3]
                if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, ":move") {
                    handleMoveColumn(w, r, boardID, strings.TrimSuffix(colID, ":move"))
                    return
                }
                if len(seg) == 5 && seg[4] == "cards" && r.Method == http.MethodPost {
                    handleCreateCard(w, r, boardID, colID)
                    return
                }
            }
        }
        if len(seg) == 4 && seg[2] == "cards" && strings.HasSuffix(seg[3], ":move") && r.Method == http.MethodPost {
            cardID := strings.TrimSuffix(seg[3], ":move")
            handleMoveCard(w, r, boardID, cardID)
            return
        }
    }
    writeError(w, r, 404, "not_found", "Route not found", nil)
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", router)
    port := os.Getenv("PORT")
    if port == "" { port = "8000" }
    srv := &http.Server{
        Addr:              ":" + port,
        Handler:           requestIDMiddleware(loggingMiddleware(mux)),
        ReadHeaderTimeout: 5 * time.Second,
    }
    log.Printf("TODO Service listening on :%s", port)
    if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
        log.Fatal(err)
    }
}

// Middleware: basic logging and request id
func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        dur := time.Since(start)
        log.Printf("%s %s %s %s", r.Method, r.URL.Path, r.RemoteAddr, dur)
    })
}

func requestIDMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        rid := r.Header.Get("X-Request-Id")
        if rid == "" {
            // generate lightweight request id
            n, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
            rid = fmt.Sprintf("req-%x", n)
            r.Header.Set("X-Request-Id", rid)
        }
        next.ServeHTTP(w, r)
    })
}

