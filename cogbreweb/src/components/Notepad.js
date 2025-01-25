import React, { useState } from "react";

function Notepad()
{
  // State to store the content of the notepad
  const [content, setContent] = useState("");

  // Function to handle text area changes
  function handleChange(event) 
  {
    setContent(event.target.value);  // Update the state with new content
  };

  // Function to handle clearing the text area
  function handleClear()
  {
    setContent("");  // Clear the content state
  };

  return (
    <div className="notepad-container">
      <h3>Notepad</h3>
      <textarea
        value={content}            // Controlled component with value tied to state
        onChange={handleChange}    // Call handleChange on user input
        placeholder="Type something here..."
        rows="10"                  // Adjust the size of the text area
        cols="30"                  // Adjust the width of the text area
      />
      <br />
      <button onClick={handleClear}>Clear</button>
    </div>
  );
};

export default Notepad;
