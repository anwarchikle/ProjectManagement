public class TimelogTriggerHandler {
    public static void costRateOfUser(List<Time_Log__c> timeLogs,Map<Id, Time_Log__c> oldMap){
        try{
            
            Set<Id> taskIds = new Set<Id>();
            Set<Id> userIds = new Set<Id>();
            
            for(Time_Log__c log : timeLogs){
                
                if(oldMap != null){
                    Time_Log__c oldRec = oldMap.get(log.Id);
                    
                    if(oldRec.Tasks__c == log.Tasks__c && oldRec.User__c == log.User__c && oldRec.Daily_Logs__c == log.Daily_Logs__c){
                        continue;
                    }
                }
                
                if(log.Tasks__c != null)
                    taskIds.add(log.Tasks__c);
                
                if(log.User__c != null)
                    userIds.add(log.User__c);
            }
            
            if(taskIds.isEmpty()) return;
            
            Map<Id, Tasks__c> taskMap = new Map<Id, Tasks__c>([SELECT Id, Associated_Project__c FROM Tasks__c WHERE Id IN :taskIds]);
            
            Set<Id> projectIds = new Set<Id>();
            
            for(Tasks__c t : taskMap.values()){
                if(t.Associated_Project__c != null)
                    projectIds.add(t.Associated_Project__c);
            }
            
            if(projectIds.isEmpty()) return;
            
            List<Project_Team_Member__c> members = [SELECT Assigned_To__c, Rate_Per_Hour__c, Project__c 
                                                    FROM Project_Team_Member__c WHERE Project__c IN :projectIds AND Assigned_To__c IN :userIds];
            
            Map<String, Decimal> rateMap = new Map<String, Decimal>();
            
            for(Project_Team_Member__c mem : members){
                String key = mem.Project__c + '-' + mem.Assigned_To__c;
                rateMap.put(key, mem.Rate_Per_Hour__c);
            }
            
            for(Time_Log__c log : timeLogs){
                
                Tasks__c relatedTask = taskMap.get(log.Tasks__c);
                if(relatedTask == null) continue;
                
                String key = relatedTask.Associated_Project__c + '-' + log.User__c;
                
                if(rateMap.containsKey(key)){
                    Decimal rate = rateMap.get(key);
                    
                    log.Rate_Per_Member__c = rate;
                    log.Cost_Amount__c = rate * log.Daily_Logs__c;
                }
            }
            
        }catch(Exception e){
            System.debug('Error => ' + e.getMessage() + ' Line => ' + e.getLineNumber());
        }
    }
    
    public static void updateMilestoneStartDate(List<Time_Log__c> newLogs){
        try{
            Set<Id> taskIds = new Set<Id>();
            
            for(Time_Log__c log : newLogs){
                if(log.Tasks__c != null){
                    taskIds.add(log.Tasks__c);
                }
            }
            
            if(taskIds.isEmpty()) return;
            
            Map<Id, Integer> taskLogCount = new Map<Id, Integer>();
            
            for(AggregateResult ar : [SELECT Tasks__c taskId, COUNT(Id) totalCount FROM Time_Log__c WHERE Tasks__c IN :taskIds GROUP BY Tasks__c]){
                taskLogCount.put((Id)ar.get('taskId'),(Integer)ar.get('totalCount'));
            }
            
            Map<Id, Tasks__c> taskMap = new Map<Id, Tasks__c>([SELECT Id,Task_List__r.Milestone__c, Task_List__r.Milestone__r.Actual_Start_Date__c
                                                               FROM Tasks__c WHERE Id IN :taskIds]);
            
            List<Milestone__c> milestonesToUpdate = new List<Milestone__c>();
            
            for(Id taskId : taskIds){
                if(taskLogCount.containsKey(taskId) &&
                   taskLogCount.get(taskId) == 1){
                       
                       Tasks__c taskRec = taskMap.get(taskId);
                       if(taskRec != null && taskRec.Task_List__r != null && taskRec.Task_List__r.Milestone__c != null){
                           Milestone__c ms = new Milestone__c();
                           ms.Id = taskRec.Task_List__r.Milestone__c;
                           
                           if(taskRec.Task_List__r.Milestone__r.Actual_Start_Date__c == null){
                               ms.Actual_Start_Date__c = Date.today();
                               milestonesToUpdate.add(ms);
                           }
                       }
                   }
            }
            
            if(!milestonesToUpdate.isEmpty()){
                update milestonesToUpdate;
            }
            
        }catch(Exception e){
            System.debug('Error => ' + e.getMessage() + ' Line => ' + e.getLineNumber());
        }
    }
    
}