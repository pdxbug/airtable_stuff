/** Created by Kerry Mraz (kerry.mraz@hearst.com) part of the HNP IT Editorial Team
 * The script is designed to take stories selected in the Shopper to add a secondary
 * record
 * 
 */

const {
    slugTableName,
    thisAirtableId,
    secondaries,
    debug,
} = input.config();

// if theres no match, create the record object making sure Feature and Account is linked
let recordsToCreate = [];
const fields = {};
const slugTable = base.getTable(slugTableName);
const view = slugTable.getView('Modifed in the last day');
const viewAfterToday = slugTable.getView('Last Month+');

let thisRecord = await slugTable.selectRecordAsync(
    thisAirtableId,
    {fields: 
        [
            // "Channel ID", //removed for consistency with Form submission KM 12/18/23
            "Created time",
            "Exclude from WCM",
            "Filing deadline",
            "In Cue?",
            "Live URL",
            "Notes",
            "Other Media",
            "Photos",
            "Primary Publication",
            "Print Pub Date",
            "Published/Scheduled Time",
            "Reporters",
            "Secondary Publication",
            "Secondary Records", //not used it record creation, but in record comparison later on
            "Slug Key",
            "Story Budget",
            "Web ETA",
            "WCM Status",
            "Words (actual)",
            "Words (est.)",
        ]
    }
);
console.log(thisRecord);
if (thisRecord == null) {
    throw new Error('This record does not exists in the view');
}

for (let field of slugTable.fields) {
    // console.log(`Field Name: `+field.name)
    if ( 
        // field.name == "Channel ID" || //removed for consistency with Form submission KM 12/18/23
        field.name == "Created time" ||
        field.name == "Exclude from WCM" ||
        field.name == "Filing deadline" ||
        field.name == "In Cue?" ||
        field.name == "Live URL" ||
        field.name == "Notes" ||
        field.name == "Other Media" ||
        field.name == "Photos" ||
        field.name == "Primary Publication" ||
        field.name == "Print Pub Date" ||
        field.name == "Published/Scheduled Time" ||
        field.name == "Reporters" ||
        field.name == "Secondary Publication" ||
        // purposely commented out KM 12/18/23
        // field.name == "Secondary Publication" not used in creation but later on in comparison
        field.name == "Slug Key" ||
        field.name == "Story Budget" ||
        field.name == "Web ETA" ||
        field.name == "WCM Status" ||
        field.name == "Words (est.)" ||
        field.name == "Words (actual)"
    ) {
        if (field.name == "Secondary Publication") {
            //get the list of secondary publications to write to
            secondaryPubs = thisRecord.getCellValue(field.name);
            // console.log(secondaryPubs);
        } else if (field.name == "Created time") {
            //get the list of secondary publications to write to
            primaryCreatedTime = thisRecord.getCellValue(field.name);
        } else if (
            field.name == "Other Media" || 
            field.name == "Created By"
        ) {
            //requires a different input from text/numbers/etc
            let record = thisRecord.getCellValue(field.name);
            if (record) {
                record.forEach(function (arrayItem) {
                    delete arrayItem.id;
                });
                fields[field.name] = record;
            }
        } else {
            // console.log(field.name + `: newRecord value `+record.getCellValue(field.name))
            // console.log(field.name + `: newRecord`);
            fields[field.name] = thisRecord.getCellValue(field.name);
        }
    }
}

recordsToCreate.push({
    fields
});

//set the secondary pubs on primary to null
if (debug == "false") {
    //update the santized slug
    slugTable.updateRecordAsync(thisAirtableId, {
        'Secondary Publication': null,
    });
} else {
    console.log("debug set to true, no changes made - Primary Entry");
}

let queryResult;
if (secondaries) {
    queryResult = await viewAfterToday.selectRecordsAsync(
        {fields: ['Secondary Publication', '🗑 Spike'],
        recordIds: secondaries}
    );
}

console.log(`recordsToCreate:`);
console.log(recordsToCreate);
const publicationTable = base.getTable('🔒 Publications');
const dailiesView = publicationTable.getView('Daily papers');
const publicationTitles = await dailiesView.selectRecordsAsync({fields: ['Publication Title']});
for (let recordToCreate of recordsToCreate) {
    //secondary publications
    console.log('secondaryPubs0');
    console.log(secondaryPubs);
    if (secondaryPubs) {
        if (secondaries) {
            console.log('secondaries');
            // console.log(secondaries);
            //check for All Texas and recreate secondary Pubs
            //creating each of the Secondary Publications in Budgets
            let newSecondaryPubs = [];
            OUTER: for (let secondaryPub of secondaryPubs) {//these are the already created pubs
                //de duplication
                //use the current secondary pub ids to check if it is already created
                console.log(queryResult);
                for (let record of queryResult.records) {//these are the records we want to create
                    let secondaryRecord = record.getCellValue('Secondary Publication');
                    let secondarySpike = record.getCellValue('🗑 Spike');
                    console.log(secondaryPub.name);
                    console.log(secondaryRecord[0].name);
                    console.log('spike: '+secondarySpike);
                    if (
                        secondaryPub &&
                        secondaryPub.name == secondaryRecord[0].name &&
                        secondarySpike != true
                    ) {
                        console.log('this already exists - next');
                        continue OUTER;
                    }
                }
                console.log('adding '+secondaryPub.name+' to newSecondaryPubs');
                newSecondaryPubs.push(secondaryPub);
            }
            secondaryPubs = newSecondaryPubs;
            console.log('secondaryPubs1');
            console.log(secondaryPubs);
        }

        newSecondaryPubs = [];
        for (let secondaryPub of secondaryPubs) {
            //checking for all texas
            if (secondaryPub.name == 'All CT dailies') {
                //we need to grab all the publications and set into secondaryPubs
                console.log(recordToCreate.fields['Primary Publication'][0])
                for (let publicationTitle of publicationTitles.records) {
                    if (publicationTitle.name != 'Wires' && publicationTitle.name != 'All CT dailies' && publicationTitle.name != recordToCreate.fields['Primary Publication'][0].name ) {
                        newSecondaryPubs.push(publicationTitle); 
                    }
                }
                //console.log(newSecondaryPubs);
                secondaryPubs = newSecondaryPubs;
                break;
            }
        }
        console.log('secondaryPubs2');
        console.log(secondaryPubs);
        if (secondaryPubs) {
            if (recordToCreate.fields['WCM ID']) {
                console.log('removed WCM ID for Secondary pub');
                delete recordToCreate.fields['WCM ID'];
            }
        
            let secondaryIds = [];
            //creating each of the Secondary Publications in Budgets
            for (let secondaryPub of secondaryPubs) {
                let secondaryId = '';
                //create the Secondary Publication
                console.log(`Creating Secondary Publication in Budget for `+secondaryPub.name)
                recordToCreate.fields['Secondary Publication'] = [secondaryPub]
                recordToCreate.fields['Primary Record Lookup'] = [{id:thisAirtableId}];
                recordToCreate.fields['Primary Record ID'] = thisAirtableId;
                recordToCreate.fields['Primary Created Time'] = primaryCreatedTime;
                recordToCreate.fields['Secondary check'] = true;
                console.log(recordToCreate.fields)

                if (debug == "false") {
                    secondaryId = await slugTable.createRecordAsync(recordToCreate.fields);
                    console.log('created secondary');
                    console.log(secondaryId);
                    secondaryIds.push({id: secondaryId});
                } else {
                    console.log("debug set to true, otherwise would have created the secondary record in "+slugTableName);
                }
            }
            if (secondaryIds.length > 0) {
                //see if there are already secondary records in the primary and add
                let secondaryRecords = thisRecord.getCellValue("Secondary Records");
                console.log('primaryRecord');
                console.log(thisRecord.id);
                // console.log(secondaryRecords);

                if (secondaryRecords != null) {
                    for (let secondaryRecord of secondaryRecords) {
                        secondaryIds.push({id: secondaryRecord.id});
                        // console.log(secondaryIds);
                    }
                }

                //update the primary with the secondary Ids
                console.log('updating primary with secondary records');
                console.log(secondaryIds);
                slugTable.updateRecordAsync(
                    thisRecord.id,
                    {
                        'Secondary Records': secondaryIds
                    }
                );

            }
        }
    }
}
