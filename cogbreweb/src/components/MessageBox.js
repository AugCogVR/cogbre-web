import React from 'react';

function MessageBox({ id, onRemove, title, message }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{title}</div>
      <textarea
        readOnly
        value={message}
        style={{
          width: '300px',
          height: '100px',
          resize: 'none',
          overflowY: 'scroll',
          marginBottom: '5px',
        }}
      />
      <br />
      <button onClick={() => onRemove(id)}>Remove</button>
    </div>
  );
}

export default MessageBox;

