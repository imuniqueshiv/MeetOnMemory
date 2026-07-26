import { useState } from "react";

const useDragAndDrop = (onDropCallback) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (onDropCallback) {
      onDropCallback(e);
    }
  };

  return {
    isDragging,
    handlers: {
      onDragOver,
      onDragLeave,
      onDrop,
    },
  };
};

export default useDragAndDrop;
