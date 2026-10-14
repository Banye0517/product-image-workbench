import React from 'react';
export default function AlignmentGuides({ guides, width, height }) {
  return <div className="alignment-guides" aria-hidden="true">
    {guides.x !== undefined && <i className="alignment-guide vertical" style={{ left: guides.x / width * 100 + '%' }}/>}
    {guides.y !== undefined && <i className="alignment-guide horizontal" style={{ top: guides.y / height * 100 + '%' }}/>}
  </div>;
}
