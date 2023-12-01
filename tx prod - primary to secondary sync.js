// const {
//     thisTable,
//     debug,
//     thisAirtableId,
//     thisFilingDate,
//     thisInCue,
//     thisNotes,
//     thisLiveUrl,
//     thisOtherMedia,
//     thisPhotos,
//     thisPrintPubDate,
//     thisPublishedScheduled,
//     thisSpike,
//     thisPublication,
//     thisPubSched
//     thisReporter,
//     thisSecondaryPub,
//     thisSlug,
//     thisSlugKey,
//     thisStoryBudget,
//     thisWebEta,
//     thisWcmStatus,
//     thisWcmId,
//     thisWordsAct,
//     thisWordsEst,
//     thisCreatedTime,
//     thisChannelID,
//     lastModifiedBy
// } = input.config();

let inputConfig = input.config();
console.log(`${inputConfig.lastModifiedBy}`);

let updateFields = {
    thisChannelID: { 
            field:'Channel ID',
            type: 'selectById'
        },
    thisSlugKey: { 
            field:'Slug Key',
            type: 'text'
        },
    thisStoryBudget: { 
            field:'Story Budget',
            type: 'text'
        },
    thisReporter: { 
            field:'Reporters',
            type: 'multiselect'
        },
    thisNotes: { 
            field:'Notes',
            type: 'text'
        },
    thisWordsEst: { 
            field:'Words (est.)',
            type: 'number'
        },
    thisPhotos: { 
            field:'Photos',
            type: 'text'
        },
    thisOtherMedia: { 
            field:'Other Media',
            type: 'mutliselect'
        },
    thisFilingDeadline: { 
            field:'Filing deadline',
            type: 'text'
        },
    thisWebEta: { 
            field:'Web ETA',
            type: 'text'
        },
    thisWcmStatus: { 
            field:'WCM Status',
            type: 'selectByName'
        },
    
    thisInCue: { 
            field:'In Cue?',
            type: 'checkbox'
        },
    thisWordsAct: { 
            field:'Words (actual)',
            type: 'text'
        },
    thisPubSched: { 
            field:'Published/Scheduled Time',
            type: 'text'
        },
    thisLiveUrl: { 
            field:'Live URL',
            type: 'text'
        },
    thisSpike: { 
            field:'🗑 Spike',
            type: 'checkbox'
        },
};

const table = base.getTable(`${inputConfig.thisTable}`);
// console.log(table.fields);

if (`${inputConfig.thisPrimaryRecordId}` == "null") {

    //primary record
    console.log('Primary Record - sync with secondaries')
    //set up fields to update
    let fields = {};
    for (let property in updateFields) {
        if (inputConfig[property]) {
            if (updateFields[property].type == 'selectById') {
                if (inputConfig[property][0]) {
                    fields[updateFields[property].field] = [{id:inputConfig[property][0]}];
                } else {
                    fields[updateFields[property].field] = null;
                }
            } else if (updateFields[property].type == 'selectByName') {
                fields[updateFields[property].field] = {name:inputConfig[property]};
            } else if (updateFields[property].type == 'multiselect') {
                let values = [];
                for (let value of inputConfig[property]) {
                    values.push({id:value});
                }
                fields[updateFields[property].field] = values;
            } else if (
                updateFields[property].type == 'number' || 
                updateFields[property].type == 'text' || 
                updateFields[property].type == 'time' || 
                updateFields[property].type == 'checkbox') {
                fields[updateFields[property].field] = inputConfig[property];
            } else {
                fields[updateFields[property].field] = null;
            }
        } else {
            fields[updateFields[property].field] = null;
        }
    }

    //list of the secondary ids should be in Secondary Records
    //if there isn't anything in Secondary Records, we can skip (add this to a view to prevent automation trigger)
    let secondaryIds = `${inputConfig.thisSecondaryRecordIds}`.split(',');
    //console.log(secondaryIds);
    for (let secondaryId of secondaryIds) {
        console.log(secondaryId);
        console.log(fields);
        if (`${inputConfig.debug}` == "false") {
            await table.updateRecordAsync(secondaryId, fields);
        } else {
            console.log('debug is set to true, nothing changed');
        }
    }
} else {
    //secondary record
        //we need to first find the primary pub
        //get all the necessary info
        //and then push back to this secondary
        //we can't allow secondaries to be modified
    
    let theseFields = ["Primary Record ID"];
    for (let value in updateFields) {
        theseFields.push(updateFields[value].field);
    }
    let existingRecords = await table.selectRecordsAsync({ 
        fields: theseFields,
    });

    console.log('Secondary Record - sync with primary');
    let primaryRecordId = `${inputConfig.thisPrimaryRecordId}`;
    let primaryRecord = existingRecords.getRecord(primaryRecordId);

    //set up fields to update
    let fields = {};
    for (let property in updateFields) {
        //fields to skip for secondary
        if (updateFields[property].field != '🗑 Spike') {
            if (primaryRecord.getCellValue(updateFields[property].field)) {
                if (updateFields[property].type == 'selectById') {
                    fields[updateFields[property].field] = primaryRecord.getCellValue(updateFields[property].field);
                } else if (updateFields[property].type == 'selectByName') {
                    fields[updateFields[property].field] = primaryRecord.getCellValue(updateFields[property].field);
                } else if (updateFields[property].type == 'multiselect') {
                    let values = [];
                    for (let value of primaryRecord.getCellValue(updateFields[property].field)) {
                        values.push(value);
                    }
                    fields[updateFields[property].field] = values;
                } else if (
                    updateFields[property].type == 'number' || 
                    updateFields[property].type == 'text' || 
                    updateFields[property].type == 'time' || 
                    updateFields[property].type == 'checkbox') {
                    fields[updateFields[property].field] = primaryRecord.getCellValue(updateFields[property].field);
                } else {
                    fields[updateFields[property].field] = null;
                }
            } else {
                fields[updateFields[property].field] = null;
            }
        } else {
            console.log('skipping: '+updateFields[property].field);
        }
    }

    for (let existingRecord of existingRecords.records) {
        if (`${existingRecord.getCellValueAsString("Primary Record ID")}` == primaryRecordId) {
            console.log("Primary: "+primaryRecordId);
            console.log("Secondary: "+existingRecord.id);
            console.log(fields);     
            if (`${inputConfig.debug}` == "false") {
                await table.updateRecordAsync(existingRecord.id, fields);
            } else {
                console.log('debug is set to true, nothing changed');
            }
        }
    }
}
