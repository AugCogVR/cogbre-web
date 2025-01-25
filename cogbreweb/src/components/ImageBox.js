import React, { useState } from 'react';
import 
{ 
  TransformWrapper, 
  TransformComponent,
  useControls
} from "react-zoom-pan-pinch"; // https://github.com/BetterTyped/react-zoom-pan-pinch

function Controls()
{
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="tools">
      <button onClick={() => zoomIn()}>+</button>
      <button onClick={() => zoomOut()}>-</button>
      <button onClick={() => resetTransform()}>x</button>
    </div>
  );
}

function ImageBox({ title, imageUrl, onRemove }) 
{
  return (
    <div className="image-box">
      <h4>{title}</h4>
      <TransformWrapper
        initialScale={1}
        minScale={0.10}
        maxScale={1}
      >
        {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
          <div>
            <Controls />
            <div>
              <TransformComponent>
                <img
                  src={imageUrl}
                  alt={title}
                  width="100%"
                  // style={{ transform: `scale(${state.scale})`, cursor: 'grab' }}
                  // onMouseDown={(e) => state.setPointerDown(e)}
                  // onMouseUp={() => state.setPointerUp()}
                />
              </TransformComponent>
              </div>
          </div>
        )}
      </TransformWrapper>
      <button onClick={onRemove}>Remove</button>
    </div>
  );
}

export default ImageBox;
