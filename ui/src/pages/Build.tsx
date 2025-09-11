import {
  ArrowPathIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CubeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useReportsMutation } from '@/hooks/useReports'
import { useGroupsMutation } from '@/hooks/useGroups'
import type { DataSource, StatusItemType, StatusGroupType } from '@/types/common'
import { useDragAndDrop } from "@formkit/drag-and-drop/react";
import StatusGroup from '@/components/StatusGroup'
import { getStatusClass } from '@/utils/status'
import { StatusItem } from '@/components/StatusItem'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import EditLabel from '@/components/EditLabel'
import { useAuth } from '@/auth/useAuth'
import { fetchEncrypted } from '@/api/data'


export const Build = () => {

  const { token } = useAuth();

  const [dataSource, setDataSource] = useState<DataSource>({
    api: "",
    secret: "",
  })

  const [isEncrypted, setIsEncrypted] = useState(false);
  const [name, setName] = useState<string>("Untitled");
  const [slug, setSlug] = useState<string>("untitled");
  const [statusGroups, setStatusGroups] = useState<StatusGroupType[]>([]);
  const [report, setReport] = useState("");

  const groupsMutation = useGroupsMutation();
  const [filterItems, setFilterItems] = useState("");
  const reportsMutation = useReportsMutation();

  const handleAddStatusGroup = () => {
    setStatusGroups(prev => [
      ...prev,
      { name: `group-${prev.length + 1}`, alias: `group-${prev.length + 1}`, list: [] }
    ]);
  }

  const handleReportChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setReport(event.target.value);
  };


  useEffect(() => {
    groupsMutation.mutate({ ...dataSource, report: report })
  }, [report])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reportsMutation.isSuccess) {
      reportsMutation.reset();
      setDataSource({ api: "", secret: "" });
      setIsEncrypted(false);
    } else {
      if (!isEncrypted) {
        const encrypted = await fetchEncrypted(dataSource.secret, token || "");
        setDataSource({ ...dataSource, secret: encrypted || "" })
        setIsEncrypted(true);
        reportsMutation.mutate({ api: dataSource.api, secret: encrypted })
      } else {
        reportsMutation.mutate(dataSource)
      }
    }
  }

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void => {
    const { name, value } = e.target
    setDataSource((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleChangeItemAlias = (groupName: string, itemName: string, newAlias: string) => {
    console.log("handleChangeAlias called!", groupName, itemName, newAlias);
    if (groupName !== "") {
      setStatusGroups(prevStatusGroups =>
        prevStatusGroups.map(group =>
          group.name === groupName
            ? {
              ...group,
              list: group.list.map(item =>
                item.name === itemName
                  ? { ...item, alias: newAlias }
                  : item
              )
            }
            : group
        )
      );
    }
  };


  const fl = filterItems.trim().toLowerCase();

  // this is the left column of loaded api items
  const groupName = "status-board";
  const [parent, items, setItems] = useDragAndDrop<HTMLUListElement, StatusItemType>([], { group: groupName, dragHandle: '.dnd-handle' });



  useEffect(() => {
    if (groupsMutation.data) setItems(groupsMutation.data);
  }, [groupsMutation.data, setItems]);



  const groupsFiltered =
    fl !== ""
      ? items.filter(item =>
        `${item.name} ${item.status}`.toLowerCase().includes(fl)
      )
      : items;

  // update column
  const updateGroup = (groupIndex: number, nextItems: StatusItemType[]) => {
    setStatusGroups(prev => {
      const movedNames = new Set(nextItems.map(it => it.name));

      const next = prev.map((g, i) =>
        i === groupIndex
          ? { ...g, list: nextItems }                   // keep original status
          : { ...g, list: g.list.filter(it => !movedNames.has(it.name)) }
      );

      // remove moved items from the left list
      setItems(curr => curr.filter(it => !movedNames.has(it.name)));

      return next;
    });
  };


  const renameGroup = (groupIndex: number, nextAlias: string) => {
    setStatusGroups(prev =>
      prev.map((g, i) =>
        i === groupIndex ? { ...g, alias: nextAlias } : g
      )
    );
  };

  const removeGroup = (groupIndex: number) => {
    setStatusGroups(prev => {
      const removed = prev[groupIndex]?.list ?? [];

      if (removed.length) {
        setItems(curr => {
          const leftIndex = leftIndexRef.current;

          // avoid duplicates
          const currNames = new Set(curr.map(x => x.name));
          const toReturn = removed.filter(it => !currNames.has(it.name));

          // merge with current left list
          const merged = [...curr, ...toReturn];

          // sort by previously recorded index; unknowns go to the end (stable tiebreaker by name)
          const FALLBACK = Number.MAX_SAFE_INTEGER / 2;
          merged.sort((a, b) => {
            const ia = leftIndex.get(a.name) ?? FALLBACK;
            const ib = leftIndex.get(b.name) ?? FALLBACK;
            if (ia !== ib) return ia - ib;
            return a.name.localeCompare(b.name);
          });

          return merged;
        });
      }

      // finally remove the column
      return prev.filter((_, i) => i !== groupIndex);
    });
  };

  /** remembers each item's last position in the LEFT list */
  const leftIndexRef = useRef<Map<string, number>>(new Map());

  /** whenever LEFT list order changes, record indices for items currently present */
  useEffect(() => {
    items.forEach((it, idx) => leftIndexRef.current.set(it.name, idx));
  }, [items]);

  return (
    <div>
      <div className="flex flex-row justify-between">
        <h1 className="text-2xl font-semibold">Build</h1>
        <div className="flex flex-row items-baseline"><div className="me-2">title:</div><EditLabel label={name} onChange={(e) => { setName(e); setSlug(e.toLowerCase().replaceAll(" ", "-")) }} /></div>
        <div className="flex flex-row items-baseline"><div className="me-2">path:</div><EditLabel label={slug} onChange={(e) => { setSlug(e.toLowerCase().replaceAll(" ", "-")) }} /></div>
        <button className="btn btn-outline btn-neutral" onClick={handleAddStatusGroup}>
          Add Group
        </button>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4 mt-4">
        <div className="w-[370px]">
          <div className="tabs tabs-lift">
            <label className="tab">
              <input type="radio" name="build_tabs" defaultChecked />
              <Cog6ToothIcon className="size-4 me-2" />
              Config
            </label>
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4">
                <legend className="fieldset-legend">
                  <CircleStackIcon className="size-4" />
                  Data Source
                </legend>

                <label className="label">Argo-web-api endpoint (URL):</label>
                <input
                  type="text"
                  className="input"
                  placeholder="https://"
                  name="api"
                  value={dataSource.api}
                  onChange={handleInputChange}
                  disabled={reportsMutation.isSuccess}
                />

                <label className="label">Access Token:</label>
                <input
                  type="password"
                  className="input"
                  placeholder="s3cr3t"
                  name="secret"
                  value={dataSource.secret}
                  onChange={handleInputChange}
                  disabled={reportsMutation.isSuccess}
                />

                <button className="btn btn-light mt-2" onClick={handleSubmit}>

                  {reportsMutation.isPending ?
                    <><ArrowPathIcon className="animate-spin size-4" /><span>Connecting ...</span></>
                    : reportsMutation.data ? 'Clear Connection' : 'Connect'}
                </button>
              </fieldset>

              {reportsMutation.error && (
                <div className="mt-4 p-4 bg-red-100 rounded">
                  Error: {reportsMutation.error.message}
                </div>
              )}
              {reportsMutation.isSuccess && (
                <div className="mt-4 p-4 bg-green-100 rounded">
                  <CheckBadgeIcon className="size-6 inline-block me-2" /> Connected succesfully
                </div>
              )}
            </div>

            <label className={`tab ${reportsMutation.isSuccess ? "" : "tab-disabled"}`}>
              <input type="radio" name="build_tabs" />
              <CubeIcon className="size-4 me-2" />
              Items
            </label>

            <div className="tab-content bg-base-100 border-base-300 p-6">
              {reportsMutation.data && (
                <>
                  <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4">
                    <label className="label">Report:</label>
                    <select defaultValue="Select a report" className="select" onChange={handleReportChange}>
                      <option disabled={true}>Select a report</option>
                      {reportsMutation.data.map((item) => (
                        <option key={item.name}>{item.name}</option>
                      ))}
                    </select>

                    {groupsMutation.isPending &&
                      <div className="p-2 text-base mt-2 mx-auto"><ArrowPathIcon className="size-4 animate-spin inline-block me-2" /> Loading items...</div>
                    }

                    {groupsMutation.data && (
                      (groupsFiltered ?? []).length === 0 ? (
                        <div className="text-sm text-red-600 p-2 mt-2 bg-red-100 border-red-600 border text-center rounded">
                          <ExclamationTriangleIcon className="size-4 me-2 inline-block" />Report empty!
                        </div>
                      ) :
                        <>
                          <label className="label mt-2">Items:</label>

                          <input
                            type="text"
                            className="input"
                            placeholder="Search..."
                            name="filter"
                            value={filterItems}
                            onChange={(e) => { setFilterItems(e.target.value) }}
                          />

                          <div className="mt-2 max-h-[500px] overflow-x-scroll">
                            <ul ref={parent}>
                              {(groupsFiltered ?? []).map(group => (
                                <li key={group.name}>
                                  <StatusItem group="" drag={true} dragHandle="dnd-handle" name={group.name} alias={group.alias || ""} status={group.status} onChangeAlias={(v) => { console.log(v) }} />
                                </li>
                              ))}

                            </ul>
                          </div>
                        </>
                    )}
                  </fieldset>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Status Columns */}
        <div className="border-dashed border border-neutral-300 rounded-xl p-4">
          {statusGroups.length == 0
            ?
            <div className="flex flex-row justify-end">
              <div className=" bg-amber-50 p-4 text-right">
                <p className="text-3xl">☝️</p>
                <p>click here to add a group and begin placing items</p>
              </div>
            </div>
            :
            <div>
              {statusGroups.map((col, index) => (
                <StatusGroup
                  key={col.name}
                  name={col.name}
                  alias={col.alias || ""}
                  items={col.list}
                  group={groupName}
                  getStatusClass={getStatusClass}
                  onItemsChange={(next) => updateGroup(index, next)}
                  onRename={(nextName) => renameGroup(index, nextName)}
                  onRemove={() => removeGroup(index)}
                  onChangeAlias={handleChangeItemAlias}
                />
              ))}
            </div>
          }
        </div>

      </div>
      <div>
        <pre>
          {JSON.stringify({ name: name, slug: slug, api: dataSource.api, secret: dataSource.secret, report: report, groups: statusGroups, }, null, "  ")}
        </pre>
      </div>
    </div>
  )
}