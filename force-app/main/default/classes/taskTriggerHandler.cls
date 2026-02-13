public class taskTriggerHandler {
    public static final Id recordTypeAdmin = Schema.SObjectType.Tasks__c.getRecordTypeInfosByDeveloperName().get('Admin').getRecordTypeId();
    public static final Id recordTypeProjectManager = Schema.SObjectType.Tasks__c.getRecordTypeInfosByDeveloperName().get('Project_Manager').getRecordTypeId();
    public static final Id recordTypeAdminQualityAssurance = Schema.SObjectType.Tasks__c.getRecordTypeInfosByDeveloperName().get('Quality_Assurance').getRecordTypeId();
    public static final Id recordTypeAdminSeniorDeveloper = Schema.SObjectType.Tasks__c.getRecordTypeInfosByDeveloperName().get('Senior_Developer').getRecordTypeId();
    
    public static void validation(List<Tasks__c> taskList){
        try{
            
            for(Tasks__c tskRec : taskList){
                if(tskRec.recordTypeId == recordTypeAdmin){
                    
                }else if(tskRec.recordTypeId == recordTypeProjectManager){
                    
                }else if(tskRec.recordTypeId == recordTypeAdminQualityAssurance){
                    
                }else if(tskRec.recordTypeId == recordTypeAdminSeniorDeveloper){
                    
                }
            }
            
        }catch(exception e){
            system.debug(' error message =====> ' + e.getMessage() + ' at line number =====> '+ e.getLineNumber());
        }
    }
    
   /* public static void rollupFromTaskLists(Set<Id> taskListIds) {
        if (taskListIds == null || taskListIds.isEmpty()) return;

        Boolean startedHere = startGuard();
        try {
            // Task_List__c.Actual_Hours__c = SUM(Tasks__c.Actual_Work_Hours__c)
            Map<Id, Decimal> tlTotals = initZeros(taskListIds);
            for (AggregateResult ar : [
                SELECT Task_List__c tlId, SUM(Actual_Work_Hours__c) sumHrs
                FROM Tasks__c
                WHERE Task_List__c IN :taskListIds
                GROUP BY Task_List__c
            ]) {
                tlTotals.put((Id) ar.get('tlId'), (Decimal) ar.get('sumHrs'));
            }

            List<Task_List__c> tlUpdates = new List<Task_List__c>();
            for (Id tlId : taskListIds) {
                tlUpdates.add(new Task_List__c(
                    Id = tlId,
                    Actual_Hours__c = tlTotals.get(tlId)
                ));
            }
            if (!tlUpdates.isEmpty()) update tlUpdates;

            // Collect impacted Milestones
            Map<Id, Task_List__c> tls = new Map<Id, Task_List__c>([
                SELECT Id, Milestone__c
                FROM Task_List__c
                WHERE Id IN :taskListIds
            ]);
            Set<Id> milestoneIds = new Set<Id>();
            for (Task_List__c tl : tls.values()) {
                if (tl.Milestone__c != null) milestoneIds.add(tl.Milestone__c);
            }
            if (!milestoneIds.isEmpty()) rollupFromMilestones(milestoneIds);
        } finally {
            endGuard(startedHere);
        }
    } */
}