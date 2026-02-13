trigger triggerOnTimelog on Time_Log__c (after insert,after update, after delete, after undelete,before insert,before update) {
    if(trigger.isInsert && trigger.isAfter){
        // commented by anwar on 12/2/26 chainging relationship to MD of task and timelog
        //TimelogTriggerHandler.aggregateTimelogOnTask(trigger.new,null);    
    }
    
    if(trigger.isUpdate && trigger.isAfter){
        //TimelogTriggerHandler.aggregateTimelogOnTask(trigger.new,trigger.oldMap);    
    }
    
    if(trigger.isDelete && trigger.isAfter){
        //TimelogTriggerHandler.aggregateTimelogOnTask(trigger.old,null);    
    }
    
    if(trigger.isBefore && trigger.isInsert){
        TimelogTriggerHandler.costRateOfUser(trigger.new,null);
    }
    if(trigger.isBefore && trigger.isInsert){
        TimelogTriggerHandler.costRateOfUser(trigger.new,trigger.OldMap);
    }
    
}