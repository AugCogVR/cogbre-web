import React from 'react';

function MessageBox({ id, onRemove, title, message }) 
{
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{title}</div>
      <textarea
        readOnly
        value={message}
        style={{
          width: '800px',
          height: '200px',
          resize: 'none',
          overflowX: 'scroll',
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

