import { useState } from "react";
import { StatusItem } from "@/components/StatusItem"

export const View = () => {

  const [alias,setAlias]= useState("");

  return (
    <div>
      <h1 className="text-2xl font-semibold">View</h1>
      <StatusItem group="group" name="test" status="OK" alias={alias} onChangeAlias={(value)=>{console.log(value); setAlias(value)}}/>
    </div>
  )
}
