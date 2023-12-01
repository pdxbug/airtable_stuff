let table = base.getTable("🗓 Budget");
let view = table.getView("secondary checklist");
let queryResult = await view.selectRecordsAsync({fields: ["Primary Record Lookup"]});
let records = await table.selectRecordsAsync({fields: ["Secondary Records"]});
//console.log(records);

let newSecondaryRecords = [];
let newSecondaryRecordIds = [];
for (let record of queryResult.records) {
    let primaryRecordId = record.getCellValue("Primary Record Lookup");
    let primaryRecord = records.getRecord(primaryRecordId[0].id);
    let secondaryRecords = primaryRecord.getCellValue("Secondary Records");
    // console.log('primaryRecord');
    // console.log(primaryRecord.id);
    // console.log(newSecondaryRecords[primaryRecord.id]);

    if (newSecondaryRecords[primaryRecord.id] === undefined) {
        newSecondaryRecords[primaryRecord.id] = [record.id];
        newSecondaryRecordIds.push(primaryRecord.id);

        if (secondaryRecords !== null) {
            for (let secondaryRecord of secondaryRecords) {
                if (newSecondaryRecords[primaryRecord.id].indexOf(secondaryRecord.id) == -1) {
                    newSecondaryRecords[primaryRecord.id].push(secondaryRecord.id);
                    // console.log(secondaryRecord.id);
                    // console.log(newSecondaryRecords[primaryRecord.id]);
                } 
                // else {
                //     console.log(secondaryRecord.id+' already exists - skipping');
                // }
            }
        }
    } else {
        if (newSecondaryRecords[primaryRecord.id].indexOf(record.id) == -1) {
            newSecondaryRecords[primaryRecord.id].push(record.id);
        } 
        // else {
        //     console.log(record.id+' already exists - skipping');
        // }
    }
    
    if (newSecondaryRecordIds.length > 60) {
        break;
    }
}

console.log(newSecondaryRecordIds.length);
let count = 1;
for (let recordId of newSecondaryRecordIds) {
    // console.log('Update secondaryRecords');
    // console.log('Primary Record');
    // console.log(recordId);
    // console.log('Secondary Record');
    // console.log(newSecondaryRecords[recordId]);
    console.log(count);
    //convert to correct ingestion types
    let field = [];
    let fields = [];
    for (secondaryRecord of newSecondaryRecords[recordId]) {
        field.push({id:secondaryRecord});
        fields.push({
            id: secondaryRecord,
            fields: {"Secondary check": true}
        });
    }

    //add the secondary records to the primary record
    await table.updateRecordAsync(recordId, 
        {
            "Secondary Records": field,
        }
    );
    //console.log('updated primary\'s secondary records');
    //check the secondary record as checked
    await table.updateRecordsAsync(
        fields
    );
    //console.log('updated secondary\'s checkbox');
    count = count + 1;
}
