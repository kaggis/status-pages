import { useDragAndDrop } from "@formkit/drag-and-drop/react";

import { useEffect, useRef } from "react";
import { TrashIcon } from "@heroicons/react/16/solid";
import type { StatusItemType } from "@/types/common";
import { StatusItem } from "./StatusItem";
import StatusLabel from "./StatusLabel";


type StatusGroupProps = {
  name: string;
  items: StatusItemType[];
  alias: string;
  group: string;
  getStatusClass: (s: string) => string;
  onItemsChange: (nextItems: StatusItemType[]) => void;
  onRename: (nextName: string) => void;
  onRemove: () => void;
  onChangeAlias: (groupName: string, itemName: string, newAlias: string) => void;
}

export default function StatusGroup(props: StatusGroupProps) {

  const [listRef, orderedItems, setOrderedItems] = useDragAndDrop<HTMLUListElement, StatusItemType>(props.items, { group: props.group, dragHandle: '.dnd-handle' });

  // notify parent when drag and drop changes this column's content/order
  const prev = useRef<StatusItemType[] | null>(null);


  const handleLocalAliasChange = (itemName: string, newAlias: string) => {

    // console
    setOrderedItems(prevOrderedItems =>
      prevOrderedItems.map(item =>
        item.name === itemName
          ? { ...item, alias: newAlias }
          : item
      ));
    props.onChangeAlias(props.name, itemName, newAlias);

  }

  useEffect(() => {
    if (prev.current !== orderedItems) {
      prev.current = orderedItems;
      props.onItemsChange(orderedItems);
    }
  }, [orderedItems, props.onItemsChange]);

  return (
    
      <div className="border-neutral-200 border-2 m-2 rounded">
        <div className="flex flex-row justify-between align-middle bg-neutral-100 p-2 rounded-t">
          <div className="drag-group-handle"></div>
          <StatusLabel group={props.name} label={props.name} alias={props.alias} onChangeAlias={props.onRename} />
          <button className="btn btn-outline btn-error" onClick={props.onRemove}><TrashIcon className="size-4" /></button>
        </div>
        <div className="min-h-[100px] p-4">

          <ul key={props.name} ref={listRef}>
            {orderedItems.map((sitem) => (
              <li key={sitem.name}>
                <StatusItem group={props.name} drag={true} dragHandle="dnd-handle" name={sitem.name} alias={sitem.alias || ""} status={sitem.status} onChangeAlias={handleLocalAliasChange} />
              </li>
            ))}
            {orderedItems.length === 0 && (
              <li className="text-xs text-neutral-500 max-h-[300px] px-2 py-3 rounded border border-dashed m-2">
                Drop items here
              </li>
            )}
          </ul>
        </div>

      </div>
   
  );
}
