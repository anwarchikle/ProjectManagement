public with sharing class NewTaskController {
    
    /**
     * @description Saves multiple tasks along with their associated team members (Task Owners)
     * @param tasksData JSON string containing task information and team member IDs
     * @return Integer - Number of tasks successfully saved
     */
    @AuraEnabled
    public static Integer saveTasksWithOwners(String tasksData) {
        try {
            // Parse the JSON data
            List<TaskWrapper> taskWrappers = (List<TaskWrapper>) JSON.deserialize(tasksData, List<TaskWrapper>.class);
            
            if (taskWrappers == null || taskWrappers.isEmpty()) {
                throw new AuraHandledException('No task data provided');
            }
            
            // Lists to hold records for DML operations
            List<Tasks__c> tasksToInsert = new List<Tasks__c>();
            List<Task_Owner__c> taskOwnersToInsert = new List<Task_Owner__c>();
            
            // Prepare Tasks for insertion
            for (TaskWrapper wrapper : taskWrappers) {
                Tasks__c newTask = new Tasks__c();
                newTask.Name = wrapper.taskName;
                newTask.Priority__c = wrapper.priority;
                newTask.Associated_Project__c = wrapper.project;
                newTask.Milestone__c = wrapper.milestone;
                newTask.Task_List__c = wrapper.taskList;
                newTask.Billing_Type__c = wrapper.billingType;
                newTask.Start_Date__c = wrapper.startDate;
                newTask.End_Date__c = wrapper.endDate;
                newTask.Work_Hours__c = wrapper.workHours;
                newTask.Comment__c = wrapper.comments; // Save the comments field
                
                tasksToInsert.add(newTask);
            }
            
            // Insert all tasks
            if (!tasksToInsert.isEmpty()) {
                insert tasksToInsert;
            }
            
            // Create Task Owner junction records
            for (Integer i = 0; i < tasksToInsert.size(); i++) {
                Tasks__c insertedTask = tasksToInsert[i];
                TaskWrapper wrapper = taskWrappers[i];
                
                // Check if team members exist for this task
                if (wrapper.teamMemberIds != null && !wrapper.teamMemberIds.isEmpty()) {
                    for (String userId : wrapper.teamMemberIds) {
                        Task_Owner__c taskOwner = new Task_Owner__c();
                        taskOwner.Tasks__c = insertedTask.Id;  // Link to the created Task
                        taskOwner.User__c = userId;            // Link to the User
                        
                        taskOwnersToInsert.add(taskOwner);
                    }
                }
            }
            
            // Insert all Task Owners
            if (!taskOwnersToInsert.isEmpty()) {
                insert taskOwnersToInsert;
            }
            
            return tasksToInsert.size();
            
        } catch (Exception e) {
            // Log the error for debugging
            System.debug('Error in saveTasksWithOwners: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            
            // Throw user-friendly error
            throw new AuraHandledException('Error saving tasks: ' + e.getMessage());
        }
    }
    
    /**
     * @description Fetches milestones based on selected project
     * @param projectId The ID of the selected project
     * @return List<Milestone__c> - List of milestones related to the project
     */
    @AuraEnabled(cacheable=true)
    public static List<Milestone__c> getMilestonesByProject(String projectId) {
        try {
            if (String.isBlank(projectId)) {
                return new List<Milestone__c>();
            }
            
            return [
                SELECT Id, Name 
                FROM Milestone__c 
                WHERE Project__c = :projectId 
                WITH SECURITY_ENFORCED
                ORDER BY Name ASC
            ];
            
        } catch (Exception e) {
            System.debug('Error in getMilestonesByProject: ' + e.getMessage());
            throw new AuraHandledException('Error fetching milestones: ' + e.getMessage());
        }
    }
    
    /**
     * @description Fetches task lists based on selected milestone
     * @param milestoneId The ID of the selected milestone
     * @return List<Task_List__c> - List of task lists related to the milestone
     */
    @AuraEnabled(cacheable=true)
    public static List<Task_List__c> getTaskListsByMilestone(String milestoneId) {
        try {
            if (String.isBlank(milestoneId)) {
                return new List<Task_List__c>();
            }
            
            return [
                SELECT Id, Name 
                FROM Task_List__c 
                WHERE Milestone__c = :milestoneId 
                WITH SECURITY_ENFORCED
                ORDER BY Name ASC
            ];
            
        } catch (Exception e) {
            System.debug('Error in getTaskListsByMilestone: ' + e.getMessage());
            throw new AuraHandledException('Error fetching task lists: ' + e.getMessage());
        }
    }
    
    /**
     * @description Wrapper class to deserialize task data from Lightning component
     */
    public class TaskWrapper {
        public String taskName { get; set; }
        public String priority { get; set; }
        public String project { get; set; }
        public String milestone { get; set; }
        public String taskList { get; set; }
        public String billingType { get; set; }
        public Date startDate { get; set; }
        public Date endDate { get; set; }
        public Decimal workHours { get; set; }
        public String comments { get; set; }
        public List<String> teamMemberIds { get; set; }
        
        public TaskWrapper() {
            this.teamMemberIds = new List<String>();
        }
    }

    // ===== Point 1: Default context resolution =====
    public class RelatedRef {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        public RelatedRef() {}
        public RelatedRef(Id i, String n) { id = i; name = n; }
    }
    public class DefaultContextResponse {
        @AuraEnabled public RelatedRef project;
        @AuraEnabled public RelatedRef milestone;
        @AuraEnabled public RelatedRef taskList;
    }

    @AuraEnabled
    public static Map<String, Id> resolveContext(Id recordId) {
        Map<String, Id> ctx = new Map<String, Id>();
        System.debug('recordId ====> ' + recordId);
        try {
            if (recordId == null ) {
                return ctx;
            }

            Schema.SObjectType sObjType = recordId.getSObjectType();
            String objectName = sObjType.getDescribe().getName();

            if (objectName == 'Task_List__c') {
                Task_List__c tl = [
                    SELECT Id, Milestone__c, Milestone__r.Project__c
                    FROM Task_List__c
                    WHERE Id = :recordId
                    WITH SECURITY_ENFORCED
                    LIMIT 1
                ];
                ctx.put('projectId', tl.Milestone__r != null ? tl.Milestone__r.Project__c : null);
                ctx.put('milestoneId', tl.Milestone__c);
                ctx.put('taskListId', tl.Id);
            }
            else if (objectName == 'Milestone__c') {
                Milestone__c ms = [
                    SELECT Id, Project__c
                    FROM Milestone__c
                    WHERE Id = :recordId
                    WITH SECURITY_ENFORCED
                    LIMIT 1
                ];
                ctx.put('projectId', ms.Project__c);
                ctx.put('milestoneId', ms.Id);
            }
            else if (objectName == 'Project__c') {
                ctx.put('projectId', recordId);

                // List<Milestone__c> ms = [
                //     SELECT Id
                //     FROM Milestone__c
                //     WHERE Project__c = :recordId
                //     WITH SECURITY_ENFORCED
                //     ORDER BY CreatedDate DESC
                //     LIMIT 1
                // ];

                // if (!ms.isEmpty()) {
                //     ctx.put('milestoneId', ms[0].Id);

                //     List<Task_List__c> tl = [
                //         SELECT Id
                //         FROM Task_List__c
                //         WHERE Milestone__c = :ms[0].Id
                //         WITH SECURITY_ENFORCED
                //         ORDER BY CreatedDate DESC
                //         LIMIT 1
                //     ];

                //     if (!tl.isEmpty()) {
                //         ctx.put('taskListId', tl[0].Id);
                //     }
                // }
            }
            else if (objectName == 'Tasks__c') {
            }

            return ctx;
        }
        catch (Exception e) {
            System.debug(' error message ====>' + e.getMessage() + ' at line number ====>' + e.getLineNumber());
            return null;
        }
    }

}