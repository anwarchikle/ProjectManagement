public with sharing class ResourcePlannerController {
    /* =========================================================
       USERS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<UserDTO> getActiveUsers() {

        Map<Id, UserDTO> userMap = new Map<Id, UserDTO>();

        for (AggregateResult ar : [
            SELECT Resource__c userId, Resource__r.Name name
            FROM Resource_Allocation__c
            WHERE Resource__c != null
            GROUP BY Resource__c, Resource__r.Name
        ]) {
            userMap.put(
                (Id) ar.get('userId'),
                new UserDTO(
                    (Id) ar.get('userId'),
                    (String) ar.get('name')
                )
            );
        }
        return userMap.values();
    }

    /* =========================================================
       PROJECTS BY USER
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<ProjectDTO> getProjectsByUser(Id userId) {

        Map<Id, ProjectDTO> projectMap = new Map<Id, ProjectDTO>();

        for (AggregateResult ar : [
            SELECT Project__c projectId, Project__r.Name name
            FROM Resource_Allocation__c
            WHERE Resource__c = :userId
            AND Project__c != null
            GROUP BY Project__c, Project__r.Name
        ]) {
            projectMap.put(
                (Id) ar.get('projectId'),
                new ProjectDTO(
                    (Id) ar.get('projectId'),
                    (String) ar.get('name')
                )
            );
        }
        return projectMap.values();
    }

    /* =========================================================
       TASK-LEVEL DAILY DATA
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<TaskDTO> getTasksByProject(
        Id userId,
        Id projectId
    ) {
        List<TaskDTO> tasks = new List<TaskDTO>();

        for (AggregateResult ar : [
            SELECT Task__c taskId,
                   Task__r.Name subject,
                   Date__c allocationDate,
                   SUM(Allocated_Hours__c) hours
            FROM Resource_Allocation__c
            WHERE Resource__c = :userId
            AND Project__c = :projectId
            AND Task__c != null
            GROUP BY Task__c, Task__r.Name, Date__c
            ORDER BY Date__c
        ]) {
            tasks.add(
                new TaskDTO(
                    (Id) ar.get('taskId'),
                    (String) ar.get('subject'),
                    (Date) ar.get('allocationDate'),
                    (Decimal) ar.get('hours')
                )
            );
        }
        return tasks;
    }

    /* =========================================================
       PROJECT DAILY ROLLUP
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<DailyDTO> getProjectDailyTotals(
        Id userId,
        Id projectId,
        Date startDate,
        Date endDate
    ) {
        return buildDailyDTOs([
            SELECT Date__c allocationDate,
                   SUM(Allocated_Hours__c) hours
            FROM Resource_Allocation__c
            WHERE Resource__c = :userId
            AND Project__c = :projectId
            AND Date__c >= :startDate
            AND Date__c <= :endDate
            GROUP BY Date__c
            ORDER BY Date__c
        ]);
    }

    /* =========================================================
       USER DAILY ROLLUP
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<DailyDTO> getUserDailyTotals(
        Id userId,
        Date startDate,
        Date endDate
    ) {
        return buildDailyDTOs([
            SELECT Date__c allocationDate,
                   SUM(Allocated_Hours__c) hours
            FROM Resource_Allocation__c
            WHERE Resource__c = :userId
            AND Date__c >= :startDate
            AND Date__c <= :endDate
            GROUP BY Date__c
            ORDER BY Date__c
        ]);
    }

    /* =========================================================
       COMMON AGGREGATE MAPPER
       ========================================================= */
    private static List<DailyDTO> buildDailyDTOs(
        List<AggregateResult> results
    ) {
        List<DailyDTO> listData = new List<DailyDTO>();

        for (AggregateResult ar : results) {
            listData.add(
                new DailyDTO(
                    (Date) ar.get('allocationDate'),
                    (Decimal) ar.get('hours')
                )
            );
        }
        return listData;
    }

    /* =========================================================
       DTOs
       ========================================================= */

    public class UserDTO {
        @AuraEnabled public Id userId;
        @AuraEnabled public String name;
        public UserDTO(Id i, String n) {
            userId = i;
            name = n;
        }
    }

    public class ProjectDTO {
        @AuraEnabled public Id projectId;
        @AuraEnabled public String name;
        public ProjectDTO(Id i, String n) {
            projectId = i;
            name = n;
        }
    }

    public class TaskDTO {
        @AuraEnabled public Id taskId;
        @AuraEnabled public String subject;
        @AuraEnabled public Date allocationDate;
        @AuraEnabled public Decimal allocatedHours;

        public TaskDTO(Id i, String s, Date d, Decimal h) {
            taskId = i;
            subject = s;
            allocationDate = d;
            allocatedHours = h != null ? h : 0;
        }
    }

    public class DailyDTO {
    @AuraEnabled public Date allocationDate;
    @AuraEnabled public Decimal hours;

    public DailyDTO(Date d, Decimal h) {
        allocationDate = d;
        hours = h != null ? h : 0;
    }
}
}