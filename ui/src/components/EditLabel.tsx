
import { useState } from 'react';

type EditLabelProps = {
  label: string;
  onChange: (newLabel: string) => void;
}

const EditLabel = (props: EditLabelProps) => {
  const [editMode, setEditMode] = useState(false);
  const [tempLabel, setTempLabel] = useState('');

  const handleEdit = () => {
    if (props.label) {
      setTempLabel(props.label);
    } else {
      setTempLabel(props.label);
    }

    setEditMode(true);
  };

  const handleSave = () => {
    props.onChange(tempLabel);
    setEditMode(false);
  };

  const handleCancel = () => {
    setTempLabel("");
    setEditMode(false);
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (

    <div className="flex items-center gap-3">
      {editMode ? (
        <>
          
          <input
            type="text"
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 font-semibold bg-gray-50 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
            autoFocus
            onBlur={handleSave}
          />
        </>
      ) : (
        <>

          <div className="flex flex-row items-center">
           
           <div className="tooltip tooltip-right" data-tip="edit">
            <span className="font-semibold text-gray-800 cursor-pointer border-b border-transparent hover:border-black hover:border-dashed" onClick={handleEdit}>
             {props.label}
            </span>
            </div>
            
          </div>
        </>
      )}

    </div>
  );
};

export default EditLabel;