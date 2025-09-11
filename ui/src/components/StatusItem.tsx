import { getStatusClass } from "@/utils/status"
import StatusLabel from "@/components/StatusLabel"


interface StatusItemProps {
    group: string
    name: string
    status?: string
    type?: string
    drag?: boolean
    dragHandle?: string
    alias?: string
    onChangeAlias: (itemName: string, newAlias: string) => void;
}




export const StatusItem = (props: StatusItemProps) => {

    const handleLocalAliasChange = (newAlias: string) => {
        props.onChangeAlias(props.name, newAlias);
    }


    return (
        <div className="flex flex-row justify-between border rounded p-2 my-2 shadow align-middle">
            <div>
                {props.dragHandle &&
                    <div className={`${props.dragHandle} cursor-grab`}>::</div>
                }
            </div>
            <div><StatusLabel group={props.group} label={props.name} alias={props.alias || ""} onChangeAlias={handleLocalAliasChange} /></div>
            <div>
                {props.status &&
                    <div className="tooltip tooltip-left" data-tip={props.status}>
                        <div aria-label="status" className={`status status-lg ${getStatusClass(props.status)}`}></div>
                    </div>
                }
            </div>
        </div>
    )
}