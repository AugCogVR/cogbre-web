import React from 'react';

function MessageBox({ id, onRemove, title, message }) 
{
  return (
    <div className="box">
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{title}</div>
      <textarea
        readOnly
        value={message}
        style={{
          width: '500px',
          height: '300px',
          resize: 'none',
          overflowX: 'scroll',
          overflowY: 'scroll',
          marginBottom: '5px',
        }}
      />
      <br />
      <button onClick={onRemove}>Remove</button>
    </div>
  );
}

export default MessageBox;

