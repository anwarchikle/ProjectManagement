public class TimelogTriggerHandler {
    public static void aggregateTimelogOnTask(List<Time_Log__c> listOfTimeLog,Map<Id,Time_Log__c> oldMap){
        try{
            set<Id> setOfTasksId = new set<Id>();
            for(Time_Log__c timeLogRec : listOfTimeLog){
                if(oldMap == null){
                    if(timeLogRec.Tasks__c != null){
                        setOfTasksId.add(timeLogRec.Tasks__c);
                    }
                }else{
                    Time_Log__c oldRec = oldMap.get(timeLogRec.Id);
                    if(timeLogRec.Tasks__c != null && (timeLogRec.Daily_Logs__c != oldRec.Daily_Logs__c || timeLogRec.Tasks__c != oldRec.Tasks__c)){
                        setOfTasksId.add(timeLogRec.Tasks__c);
                    }
                    if(oldRec.Tasks__c != null &&
                       timeLogRec.Tasks__c != oldRec.Tasks__c){
                           
                           setOfTasksId.add(oldRec.Tasks__c);
                       }
                }
            }
            if (!setOfTasksId.isEmpty()) {
                List<AggregateResult> aggregateTimeLogResults = [SELECT Tasks__c tId,SUM(Daily_Logs__c) totalLoggedHours 
                                                                 FROM Time_Log__c WHERE Tasks__c IN :setOfTasksId 
                                                                 GROUP BY Tasks__c];
                
                Map<Id, Decimal> tTotals = new Map<Id, Decimal>();
                
                for (AggregateResult ar : aggregateTimeLogResults) {
                    Id taskId = (Id) ar.get('tId');
                    Decimal totalHours = (Decimal) ar.get('totalLoggedHours');
                    tTotals.put(taskId, totalHours);
                }
                
                List<Tasks__c> tlUpdates = new List<Tasks__c>();
                
                for (Id taskId : tTotals.keySet()) {
                    tlUpdates.add(new Tasks__c(
                        Id = taskId,
                        Actual_Hours__c = tTotals.get(taskId)
                    ));
                }
                
                if (!tlUpdates.isEmpty()) {
                    update tlUpdates;
                }
            }
            
        }catch(exception e){
            system.debug(' error message =====>' + e.getMessage() + ' at line number ====>'+ e.getLineNumber());
        }
    } 
    
    public static void costRateOfUser(List<Time_Log__c> listOfTimeLog, Map<Id, Time_Log__c> oldMap) {
        try {
            Set<Id> setOfProjectId = new Set<Id>();
            
            for (Time_Log__c timeRec : listOfTimeLog) {
                if (timeRec.Projects__c != null) {
                    if (oldMap == null) {
                        setOfProjectId.add(timeRec.Projects__c);
                    } else {
                        Time_Log__c oldRec = oldMap.get(timeRec.Id);
                        if (timeRec.Projects__c != oldRec.Projects__c || 
                            timeRec.Daily_Logs__c != oldRec.Daily_Logs__c) {
                                setOfProjectId.add(timeRec.Projects__c);
                            }
                    }
                }
            }
            
            if (!setOfProjectId.isEmpty()) {
                Map<Id, Project_Team_Member__c> mapOfProjectToTeamMember = new Map<Id, Project_Team_Member__c>();
                for (Project_Team_Member__c prTeamRec : [SELECT Id, Assigned_To__c, Project__c, Employee_Cost_Based_On__c FROM Project_Team_Member__c WHERE Project__c IN :setOfProjectId AND Assigned_To__c = :UserInfo.getUserId()]) {
                    mapOfProjectToTeamMember.put(prTeamRec.Project__c, prTeamRec);
                }
                
                for (Time_Log__c timeRec : listOfTimeLog) {
                    if (timeRec.Projects__c != null && timeRec.Daily_Logs__c != null && mapOfProjectToTeamMember.containsKey(timeRec.Projects__c)) {
                        Decimal costRate = mapOfProjectToTeamMember.get(timeRec.Projects__c).Employee_Cost_Based_On__c;
                        timeRec.Cost_Amount__c = timeRec.Daily_Logs__c * costRate;
                    }
                }
            }
            
        } catch (Exception e) {
            System.debug('Error ====> ' + e.getMessage() + ' Line ====> ' + e.getLineNumber());
        }
    }
    
}