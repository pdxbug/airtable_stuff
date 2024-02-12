//this should watch for individual record that have their template status changed
let inputConfig = input.config();
let thisPubdate = `${inputConfig.thisPubdate}`;

function getPubDate(pubdate) {
    const date = new Date(pubdate);
    let day = date.getDate().toString().padStart(2, "0");
    let month = (date.getMonth() + 1).toString().padStart(2, "0");
    let year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

// This arrangement can be altered based on how we want the date's format to appear.
thisPubdate = getPubDate(thisPubdate);
let thisPublication = `${inputConfig.thisPub}`;
let thisDesk = `${inputConfig.thisDesk}`;
let thisStatus = `${inputConfig.thisStatus}`;
let thisPreviousStatus = `${inputConfig.thisPreviousStatus}`;
let thisXMLStatus = `${inputConfig.thisXMLStatus}`;
let thisAirtableId = `${inputConfig.thisAirtableId}`;
let lastModifiedBy = `${inputConfig.lastModifiedBy}`;
let templateList = `${inputConfig.templateList}`;

console.log(lastModifiedBy);
//if (lastModifiedBy != 'Automations') {
    let table = base.getTable('Layout');
    //check this status against previous status
    //if previous status is locked or send to cue, this cannot change
    console.log("Previous State: "+thisPreviousStatus);
    console.log("Current State: "+thisStatus);
    console.log("Selected Template: "+templateList);

    let keepGoing = false;
    let update;
    if (thisPreviousStatus == 'null' || thisPreviousStatus == 'Ready' || thisStatus == 'LOCKED') {
        //deal with this in recommend a template as it will appear in the view as new
        if (
            thisStatus == 'LOCKED' && 
            (
                thisPreviousStatus != 'Send to CUE' ||
                (
                    templateList != 'Plan Enrich' &&
                    templateList != 'AdsOnly'
                )
            )
        ) {
            if (thisPreviousStatus == "null") {
                update = {
                   "Template Status" : null
                };
            } else {
                update = {
                   "Template Status" : {name: thisPreviousStatus}
                };
            }
        // } else if (thisStatus == 'LOCKED' && 
        //     (
        //         thisPreviousStatus != 'Send to CUE' || 
        //         templateList != 'Plan Enrich'
        //     ) 
        // ) {
        //     //we should not be here unless plan enrich or template has been sent to cue
        //     console.log('NOT plan enrich or sent to cue, LOCKED NOT ok')
        //     update = {
        //         "Template Status" : {name: thisPreviousStatus}
        //     };
        // } else 
        } else if (thisStatus != 'null') {
            update = {
                "Previous Template Status" : thisStatus
            };
            keepGoing = true;
        }
    } else if (
        thisStatus == 'Manual Selection' && 
        thisPreviousStatus == 'LOCKED' &&
        templateList == "Plan Enrich"
    ) {
        update = {
            "Previous Template Status" : thisStatus,
            "XML Status" : {name: "Waiting"},
            "Template List" : null,
            "Previous Template" : null
        };
        keepGoing = true;
    } else if (thisStatus == 'Ready' && templateList == "") {
        //they have set to ready but haven't selected a template. push the previous status
        console.log('No template selected, restore previous state');
        update = {
            "Template Status" : {name: thisPreviousStatus}
        };
        
    } else if (thisPreviousStatus == 'Send to CUE' || thisPreviousStatus == 'LOCKED') {
        if (thisStatus == 'null' || thisStatus == 'Ready') {
            //restore the setting, might need a notes section to tell user why
            update = {
                "Template Status" : {name: thisPreviousStatus}
            };
        } else if (thisStatus == 'Send to CUE' && thisPreviousStatus == 'LOCKED') {
            update = {
                "Template Status" : {name: thisPreviousStatus}
            };
        } else if (thisStatus == 'Send to CUE') {
            update = {
                "XML Status" : {name: 'Sending'}
            };
        }
    } else {
        //push the state to the previous state
        console.log('hit the else state, assuming we push through');
        update = {
            "Previous Template Status" : thisStatus
        };
    }

    console.log(update);
    if (update) {
        table.updateRecordAsync(
            thisAirtableId,
            update
        );
    }

    if (keepGoing) {
        console.log('Check pubdate, pub, desk for completion to update top controls');
        //should watch for blank, Ready, send to cue, locked
        let view = table.getView('Story Counts');
        let queryResult = await view.selectRecordsAsync({
            fields: ["Pubdate", "Publication", "Desk", "Template Status"],
            sorts: [
                {field: "Pubdate"},
                {field: "Publication"},
            ]
        });

        let workflowTable = base.getTable('Workflow Updates');
        let workflowView = workflowTable.getView('Unoriginal');
        let workflowUpdatesQuery = await workflowView.selectRecordsAsync({
            fields: ["Pubdate", "Publication", "Desk", "Change Status"],
            sorts: [
                {field: "Pubdate"},
                {field: "Publication"},
            ]
        });
        let pubdateReadyCount = 0;
        let pubdateSentCount = 0;
        let pubdateTotalCount = 0;
        let deskReadyCount = 0;
        let deskSentCount = 0;
        let deskTotalCount = 0;
        for (let record of queryResult.records) {
            let recordPubdate = `${record.getCellValueAsString("Pubdate")}`;
            recordPubdate = getPubDate(recordPubdate);
            let recordPub = `${record.getCellValueAsString("Publication")}`;
            let recordDesk = `${record.getCellValueAsString("Desk")}`;
            let recordTempStatus = `${record.getCellValueAsString("Template Status")}`;
            if (recordPubdate > thisPubdate) {
                console.log('Beyond thisPubdate - stopping search');
                console.log('thisPubdate: '+thisPubdate);
                console.log('pubdate: '+recordPubdate);
                break;
            }
            //total count for pubdate, publication
            //used to update dropdown of other desks if all ready
            if (
                thisPubdate == recordPubdate &&
                thisPublication == recordPub
            ) {
                pubdateTotalCount++;
                //total count for desk, pubdate, publication for notes
                if (thisDesk == recordDesk) {
                    deskTotalCount++;
                    //total ready count for desk, pubdate, publication for notes
                    if (recordTempStatus == "Ready" || recordTempStatus == "Manual Selection") {
                        deskReadyCount++;
                    } else if (recordTempStatus !== "") {
                        deskSentCount++;
                    }
                }

                //total ready count for desk, pubdate, publication for notes
                if (recordTempStatus == "Ready" || recordTempStatus == "Manual Selection") {
                    pubdateReadyCount++;
                } else if (recordTempStatus !== "") {
                    pubdateSentCount++;
                }
            }
        }

        console.log('pubdateTotalCount '+pubdateTotalCount);
        console.log('pubdateSentCount '+pubdateSentCount);
        console.log('pubdateReadyCount '+pubdateReadyCount);
        console.log('deskTotalCount '+deskTotalCount);
        console.log('deskSentCount '+deskSentCount);
        console.log('deskReadyCount '+deskReadyCount);
        if (
            pubdateTotalCount != 0 &&
            (pubdateTotalCount == (pubdateReadyCount + pubdateSentCount) || 
            deskTotalCount == (deskReadyCount + deskSentCount))
        ) {
            if (pubdateTotalCount == pubdateReadyCount) {
                console.log('All set to ready for pubdate and publication!');
            } else {
                console.log('All set to ready for publication and desk!');
            }
            //we are all ready and need to make sure the drop downs for all desks for this pubdate and publication
            //are set to ready
            let updateRecords = [];
            for (let workflowUpdateRecord of workflowUpdatesQuery.records) {
                let recordPub = `${workflowUpdateRecord.getCellValueAsString("Publication")}`;
                let recordDesk = `${workflowUpdateRecord.getCellValueAsString("Desk")}`;
                let recordPubdate = `${workflowUpdateRecord.getCellValueAsString("Pubdate")}`;
                recordPubdate = getPubDate(recordPubdate);
                let recordTempStatus = `${workflowUpdateRecord.getCellValueAsString("Change Status")}`;
                if (recordPubdate > thisPubdate) {
                    console.log('stopping search for top configuration to update because pubdates');
                    console.log('Update Pubdate: '+thisPubdate);
                    console.log(`Search Pubdate: ${workflowUpdateRecord.getCellValueAsString("Pubdate")}`);
                    break;
                }
                if (
                    thisPublication == recordPub &&
                    thisPubdate == recordPubdate &&
                    recordTempStatus == '' &&
                    pubdateTotalCount == (pubdateReadyCount + pubdateSentCount) &&
                    (
                        recordDesk == 'All Desks' ||
                        recordDesk == thisDesk
                    )
                ) {
                    let notes = '';
                    if (recordDesk == 'All Desks') {
                        notes = pubdateReadyCount+': Ready '+pubdateSentCount+': Sent of '+pubdateTotalCount+' records';
                    } else {
                        notes = deskReadyCount+': Ready '+deskSentCount+': Sent of '+deskTotalCount+' records';
                    }
                    let changeStatus = {name:"Set to Ready"};
                    if (deskTotalCount == deskSentCount) {
                        changeStatus = {name:"LOCKED"};
                        console.log('locked!')
                    }
                    updateRecords.push(
                        {
                            id: workflowUpdateRecord.id,
                            fields: 
                            {
                                'Change Status': changeStatus,
                                'Notes': notes
                            }
                        }
                    );
                } else if (
                    thisPublication == recordPub &&
                    thisPubdate == recordPubdate &&
                    thisDesk == recordDesk &&
                    //recordTempStatus == '' &&
                    deskTotalCount == (deskReadyCount + deskSentCount)
                ) {
                    let changeStatus = {name:"Set to Ready"};
                    if (deskTotalCount == deskSentCount) {
                        changeStatus = {name:"LOCKED"};
                        console.log('locked!')
                    }
                    updateRecords.push(
                        {
                            id: workflowUpdateRecord.id,
                            fields: 
                            {
                                'Change Status': changeStatus,
                                'Notes': deskReadyCount+': Ready '+deskSentCount+': Sent of '+deskTotalCount+' records'
                            }
                        }
                    );
                }
            }
            if (updateRecords.length > 0) {
                workflowTable.updateRecordsAsync(updateRecords);
                console.log('sent '+updateRecords.length+' updates');
            }
        } else if (deskTotalCount != deskReadyCount) {
            console.log('desk not ready, unset the desk and all desks');
            console.log('deskTotalCount '+deskTotalCount);
            console.log('deskReadyCount '+deskReadyCount);
            let updateRecords = [];
            for (let workflowUpdateRecord of workflowUpdatesQuery.records) {
                let recordPubdate = `${workflowUpdateRecord.getCellValueAsString("Pubdate")}`;
                recordPubdate = getPubDate(recordPubdate);
                if (recordPubdate > thisPubdate) {
                    console.log('stopping search for desks to update because pubdates');
                    console.log('Update Pubdate: '+thisPubdate);
                    console.log(`Search Pubdate: '+recordPubdate`);
                    break;
                }
                let recordPub = `${workflowUpdateRecord.getCellValueAsString("Publication")}`;
                let recordDesk = `${workflowUpdateRecord.getCellValueAsString("Desk")}`;
                let recordTempStatus = `${workflowUpdateRecord.getCellValueAsString("Change Status")}`;            
                if (
                    thisPublication == recordPub &&
                    thisPubdate == recordPubdate &&
                    recordTempStatus == 'Set to Ready' &&
                    (
                        recordDesk == 'All Desks' ||
                        recordDesk == thisDesk
                    )
                ) {
                    let notes = 'Not all pages ready, removed ready status';
                    console.log('update '+workflowUpdateRecord.id);
                    updateRecords.push(
                        {
                            id: workflowUpdateRecord.id,
                            fields: 
                            {
                                'Change Status': null,
                                'Notes': notes
                            }
                        }
                    );
                } else if (
                    thisPublication == recordPub &&
                    thisPubdate == recordPubdate &&
                    thisDesk == recordDesk &&
                    recordTempStatus == '' &&
                    deskTotalCount == deskReadyCount
                ) {
                    let changeStatus = {name:"Set to Ready"};
                    if (deskTotalCount == deskSentCount) {
                        changeStatus = {name:"LOCKED"};
                        console.log('locked!')
                    }
                    updateRecords.push(
                        {
                            id: workflowUpdateRecord.id,
                            fields: 
                            {
                                'Change Status': changeStatus,
                                'Notes': deskReadyCount+' of '+deskTotalCount+' records: Ready'
                            }
                        }
                    );
                }
            }
            if (updateRecords.length > 0) {
                workflowTable.updateRecordsAsync(updateRecords);
                console.log('sent '+updateRecords.length+' updates');
            }
        }
    }
//}
