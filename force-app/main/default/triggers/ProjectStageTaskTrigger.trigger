trigger ProjectStageTaskTrigger on Project__c (before update,after insert, after update) {
    
    if(Trigger.isBefore && Trigger.isUpdate){
        ProjectStageTaskHandler.validateProjectManager(Trigger.new, Trigger.oldMap);
    }
    

    if(Trigger.isAfter){
        
        if(Trigger.isInsert){
            ProjectStageTaskHandler.processProjects(Trigger.new, null, true);
        }
        
        if(Trigger.isUpdate){
            ProjectStageTaskHandler.processProjects(Trigger.new,Trigger.oldMap,false);
        }
    }
}