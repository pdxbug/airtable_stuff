let table = base.getTable("🗓 Budget");
let view = table.getView("Fix Primary Records");
let queryResult = await view.selectRecordsAsync({fields: ["Primary Record Lookup"]});
//console.log(records);

for (let record of queryResult.records) {
    let primaryRecordId = record.getCellValue("Primary Record Lookup");
    // console.log(primaryRecordId[0].id);
    await table.updateRecordAsync(record.id, 
        {
            "Primary Record ID": primaryRecordId[0].id,
        }
    );
}
