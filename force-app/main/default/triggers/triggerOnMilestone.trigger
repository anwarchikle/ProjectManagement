trigger triggerOnMilestone on Milestone__c (before insert,before update,after insert, after update, after delete, after undelete) {
    if(trigger.isBefore && trigger.isUpdate){
        MilesotoneTriggerHelper.updateMilestoneStartDate(trigger.new, trigger.oldMap);
    }
}