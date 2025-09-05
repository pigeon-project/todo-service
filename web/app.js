(() => {
  const { useState, useEffect, useMemo } = React;
  const M = MaterialUI;

  const API_BASE = '/v1';
  const TOKEN = 'demo-user'; // placeholder token per SPEC

  async function api(path, opts = {}) {
    const headers = Object.assign({
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Request-Id': `web-${Math.random().toString(16).slice(2)}`
    }, opts.headers || {});
    // Idempotency for POST
    if ((opts.method || 'GET').toUpperCase() === 'POST' && !headers['Idempotency-Key']) {
      headers['Idempotency-Key'] = cryptoRandomUUID();
    }
    const res = await fetch(`${API_BASE}${path}`, Object.assign({}, opts, { headers }));
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) { throw body?.error || { message: 'Request failed', code: 'http_error' }; }
    return body;
  }

  function cryptoRandomUUID() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const s = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
  }

  function useBoards() {
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refetch = async () => {
      setLoading(true); setError(null);
      try { const data = await api('/boards'); setBoards(data.boards || []); }
      catch (e) { setError(e.message || 'Failed to load'); }
      finally { setLoading(false); }
    };
    useEffect(() => { refetch(); }, []);
    return { boards, loading, error, refetch, setBoards };
  }

  function BoardList({ onOpen }) {
    const { boards, loading, error, refetch, setBoards } = useBoards();
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [creating, setCreating] = useState(false);
    const createBoard = async (e) => {
      e.preventDefault(); if (!name.trim()) return;
      setCreating(true);
      try {
        const b = await api('/boards', { method: 'POST', body: JSON.stringify({ name, description: desc || null }) });
        setBoards([b, ...boards]); setName(''); setDesc('');
      } catch (e) { alert(e.message || 'Failed to create'); }
      finally { setCreating(false); }
    };
    return (
      React.createElement('div', { className: 'container' },
        React.createElement('h2', null, 'Boards'),
        error && React.createElement('div', { className: 'error' }, error),
        React.createElement('form', { onSubmit: createBoard, className: 'row', style: { marginBottom: 12 } },
          React.createElement(M.TextField, { size: 'small', label: 'Board name', value: name, onChange: e => setName(e.target.value) }),
          React.createElement(M.TextField, { size: 'small', label: 'Description', value: desc, onChange: e => setDesc(e.target.value), style: { minWidth: 240 } }),
          React.createElement(M.Button, { variant: 'contained', type: 'submit', disabled: creating || !name.trim() }, 'Create')
        ),
        React.createElement(M.List, null,
          (loading ? [1,2,3] : boards).map((b, i) => (
            React.createElement(M.ListItem, { key: b?.id || i, button: true, onClick: () => !loading && onOpen(b.id) },
              React.createElement(M.ListItemText, { primary: b?.name || 'Loading...', secondary: b?.description || '' })
            )
          ))
        ),
        React.createElement(M.Button, { onClick: refetch, size: 'small' }, 'Refresh')
      )
    );
  }

  function useBoard(boardId) {
    const [state, setState] = useState({ board: null, columns: [], cards: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refetch = async () => {
      setLoading(true); setError(null);
      try { const data = await api(`/boards/${boardId}`); setState(data); }
      catch (e) { setError(e.message || 'Failed to load'); }
      finally { setLoading(false); }
    };
    useEffect(() => { refetch(); }, [boardId]);
    // helpers
    const addColumn = async (name) => {
      const last = state.columns[state.columns.length - 1];
      const payload = { name, beforeColumnId: null, afterColumnId: last ? last.id : null };
      const col = await api(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify(payload) });
      setState(s => ({ ...s, columns: [...s.columns, col] }));
    };
    const moveColumn = async (colId, dir) => {
      const idx = state.columns.findIndex(c => c.id === colId); if (idx < 0) return;
      const to = Math.max(0, Math.min(state.columns.length - 1, idx + (dir === 'left' ? -1 : 1)));
      if (to === idx) return;
      const before = state.columns[to] || null;
      const after = state.columns[to - 1] || (to === 0 ? null : null);
      const payload = { beforeColumnId: before ? before.id : null, afterColumnId: after ? after.id : (to>0?state.columns[to-1].id:null) };
      await api(`/boards/${boardId}/columns/${colId}:move`, { method: 'POST', body: JSON.stringify(payload) });
      const cols = [...state.columns]; const [c] = cols.splice(idx,1); cols.splice(to,0,c); setState(s => ({ ...s, columns: cols }));
    };
    const addCard = async (columnId, title) => {
      const cards = state.cards.filter(c => c.columnId === columnId);
      const last = cards[cards.length-1];
      const payload = { title, description: null, beforeCardId: null, afterCardId: last ? last.id : null };
      const card = await api(`/boards/${boardId}/columns/${columnId}/cards`, { method: 'POST', body: JSON.stringify(payload) });
      setState(s => ({ ...s, cards: [...s.cards, card] }));
    };
    const moveCard = async (cardId, toColumnId, toIndex) => {
      const targetCards = state.cards.filter(c => c.columnId === toColumnId).sort((a,b)=> (a.sortKey<b.sortKey?-1:a.sortKey>b.sortKey?1: a.createdAt<b.createdAt?-1: a.id<b.id? -1:1));
      const before = targetCards[toIndex] || null;
      const after = targetCards[toIndex-1] || null;
      const card = state.cards.find(c => c.id === cardId);
      const payload = { toColumnId, beforeCardId: before ? before.id : null, afterCardId: after ? after.id : null, expectedVersion: card?.version ?? 0 };
      await api(`/boards/${boardId}/cards/${cardId}:move`, { method: 'POST', body: JSON.stringify(payload) });
      // optimistic local reorder
      setState(s => {
        const cards = s.cards.map(c => c.id === cardId ? { ...c, columnId: toColumnId, version: (c.version||0)+1 } : c);
        const moved = cards.find(c => c.id === cardId);
        const rest = cards.filter(c => c.id !== cardId);
        const left = rest.filter(c => c.columnId !== toColumnId);
        const target = rest.filter(c => c.columnId === toColumnId);
        target.splice(Math.max(0, toIndex), 0, moved);
        return { ...s, cards: [...left, ...target] };
      });
    };
    return { state, loading, error, refetch, addColumn, moveColumn, addCard, moveCard };
  }

  function BoardView({ boardId, onBack }) {
    const { state, loading, error, refetch, addColumn, moveColumn, addCard, moveCard } = useBoard(boardId);
    const [colName, setColName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('writer');
    const invite = async (e) => {
      e.preventDefault(); if (!inviteEmail.trim()) return;
      await api(`/boards/${boardId}/members`, { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) });
      setInviteEmail(''); alert('Invitation created');
    };
    const columns = state.columns;
    const cardsByCol = useMemo(() => {
      const m = new Map(); for (const c of state.cards) { if (!m.has(c.columnId)) m.set(c.columnId, []); m.get(c.columnId).push(c); }
      for (const [k,v] of m) { v.sort((a,b)=> (a.sortKey<b.sortKey?-1:a.sortKey>b.sortKey?1: a.createdAt<b.createdAt?-1: a.id<b.id? -1:1)); }
      return m;
    }, [state.cards]);
    return (
      React.createElement('div', { className: 'container' },
        React.createElement('div', { className: 'toolbar' },
          React.createElement(M.Button, { onClick: onBack }, 'Back'),
          React.createElement(M.Button, { onClick: refetch }, 'Refetch')
        ),
        error && React.createElement('div', { className: 'error' }, error),
        React.createElement('h2', null, state.board?.name || 'Board'),
        React.createElement('form', { onSubmit: e => { e.preventDefault(); if (colName.trim()) addColumn(colName.trim()).then(()=>setColName('')); } , className: 'row', style: { marginBottom: 12 } },
          React.createElement(M.TextField, { size: 'small', label: 'New column', value: colName, onChange: e => setColName(e.target.value) }),
          React.createElement(M.Button, { variant: 'contained', type: 'submit', disabled: !colName.trim() }, 'Add column')
        ),
        React.createElement('div', { className: 'columns' },
          columns.map((col, idx) => (
            React.createElement('div', { key: col.id, className: 'column' },
              React.createElement('div', { className: 'column-header' },
                React.createElement('strong', null, col.name),
                React.createElement('span', null,
                  React.createElement(M.IconButton, { size: 'small', onClick: () => moveColumn(col.id, 'left') }, React.createElement('span', null, '◀')),
                  React.createElement(M.IconButton, { size: 'small', onClick: () => moveColumn(col.id, 'right') }, React.createElement('span', null, '▶'))
                )
              ),
              React.createElement(ColumnView, { column: col, cards: (cardsByCol.get(col.id) || []), onAdd: t => addCard(col.id, t), onMoveCard: (cardId, toIndex) => moveCard(cardId, col.id, toIndex) })
            )
          ))
        ),
        React.createElement('h3', null, 'Invite member (admin)'),
        React.createElement('form', { onSubmit: invite, className: 'row', style: { marginTop: 8 } },
          React.createElement(M.TextField, { size: 'small', label: 'Email', value: inviteEmail, onChange: e => setInviteEmail(e.target.value) }),
          React.createElement(M.TextField, { size: 'small', label: 'Role', value: inviteRole, onChange: e => setInviteRole(e.target.value) }),
          React.createElement(M.Button, { type: 'submit', variant: 'outlined' }, 'Invite')
        )
      )
    );
  }

  function ColumnView({ column, cards, onAdd, onMoveCard }) {
    const [title, setTitle] = useState('');
    const add = (e) => { e.preventDefault(); if (!title.trim()) return; onAdd(title.trim()); setTitle(''); };
    return (
      React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'cards' },
          cards.map((card, i) => (
            React.createElement('div', { key: card.id, className: 'card' },
              React.createElement('div', { className: 'row' },
                React.createElement('div', { className: 'space' }, card.title),
                React.createElement(M.IconButton, { size: 'small', onClick: () => onMoveCard(card.id, Math.max(0, i-1)) }, React.createElement('span', null, '▲')),
                React.createElement(M.IconButton, { size: 'small', onClick: () => onMoveCard(card.id, Math.min(cards.length-1, i+1)) }, React.createElement('span', null, '▼'))
              )
            )
          ))
        ),
        React.createElement('form', { onSubmit: add, className: 'row', style: { marginTop: 8 } },
          React.createElement(M.TextField, { size: 'small', label: 'New card', value: title, onChange: e => setTitle(e.target.value) }),
          React.createElement(M.Button, { size: 'small', type: 'submit' }, 'Add')
        )
      )
    );
  }

  function App() {
    const [boardId, setBoardId] = useState(null);
    if (!boardId) return React.createElement(BoardList, { onOpen: setBoardId });
    return React.createElement(BoardView, { boardId, onBack: () => setBoardId(null) });
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
})();

