trigger triggerOnTimelog on Time_Log__c (after insert,after update, after delete, after undelete,before insert,before update) {
    
    if(trigger.isBefore && trigger.isInsert){
        TimelogTriggerHandler.costRateOfUser(trigger.new,null);
    }
    if(trigger.isBefore && trigger.isUpdate){
        TimelogTriggerHandler.costRateOfUser(trigger.new,trigger.OldMap);
    }
    
    if(Trigger.isAfter && Trigger.isInsert){
        TimelogTriggerHandler.updateMilestoneStartDate(Trigger.new);
    }
    
}