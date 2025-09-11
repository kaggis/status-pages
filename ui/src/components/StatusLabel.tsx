
import { useState } from 'react';

type StatusLabelProps = {
  group: string;
  label: string;
  alias: string;
  onChangeAlias: (newAlias: string) => void;
}

const StatusLabel = (props: StatusLabelProps) => {
  const [editMode, setEditMode] = useState(false);
  const [tempLabel, setTempLabel] = useState('');

  const handleEdit = () => {
    if (props.alias) {
      setTempLabel(props.alias);
    } else {
      setTempLabel(props.label);
    }

    setEditMode(true);
  };

  const handleSave = () => {
    props.onChangeAlias(tempLabel);
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
            {props.group
           ? <div className="tooltip tooltip-right" data-tip="edit">
            <span className="font-semibold text-gray-800 cursor-pointer border-b border-transparent hover:border-black hover:border-dashed" onClick={handleEdit}>
              {props.alias ? props.alias : props.label}
            </span>
            </div>
            : <span className="font-semibold text-gray-800 border-b border-transparent" >
              {props.label}
            </span>
             }
          </div>
        </>
      )}

    </div>
  );
};

export default StatusLabel;