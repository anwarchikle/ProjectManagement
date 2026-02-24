public with sharing class ProjectDashboardService {

    public class StatusCount {
        @AuraEnabled public String status;
        @AuraEnabled public Integer count;

        public StatusCount(String s, Integer c) {
            status = s;
            count = c;
        }
    }

    public class ProjectDashboardDTO {
        @AuraEnabled public Project__c project;
        @AuraEnabled public List<Tasks__c> tasks;
        @AuraEnabled public List<Issue_Bug__c> bugs;
        @AuraEnabled public List<StatusCount> taskStatusSummary;
        @AuraEnabled public List<StatusCount> bugStatusSummary;
        @AuraEnabled public Integer totalTasks;
        @AuraEnabled public Integer overdueTasks;
        @AuraEnabled public Integer todaysTasks;
        @AuraEnabled public Integer upcomingTasks;
        @AuraEnabled public Integer bugsInRetest;
    }

    @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjects(Id projectId) {

        try {

            if (projectId != null) {

                return [
                    SELECT
                        Id,
                        Name,
                        Status__c,
                        Start_Date__c,
                        End_Date__c,
                        Planned_Hours__c,
                        Actual_Hours__c,

                        (SELECT
                            Id,
                            Name,
                            Allocation__c,
                            Assigned_To__c,Assigned_To__r.Name,
                            Employee_Cost__c,
                            Employee_Cost_Based_On__c,
                            End_Date__c,
                            Is_Active__c,
                            Is_Current__c,
                            Project__c,
                            Rate__c,
                            Rate_Per_Hour__c,
                            Role__c,
                            Start_Date__c
                         FROM Project_Teams__r
                         WHERE Is_Active__c = true
                         ORDER BY CreatedDate DESC),

                        (SELECT
                            Id,
                            Name,
                            Status__c,
                            Start_Date__c,
                            End_Date__c,
                            Planned_Hours__c,
                            Actual_Work_Hours__c,

                            (SELECT
                                Id,
                                Name,
                                Planned_Hours__c,
                                Actual_Hours__c,
                                Start_Date__c,
                                End_Date__c,

                                (SELECT
                                    Id,
                                    Name,
                                    Status__c,
                                    Start_Date__c,
                                    End_Date__c,
                                    Work_Hours__c,
                                    Logged_Hours__c
                                 FROM Tasks__r
                                 WHERE Is_Active__c = true
                                 ORDER BY CreatedDate DESC)

                             FROM Task_Lists__r
                             WHERE Is_Active__c = true
                             ORDER BY CreatedDate DESC)

                         FROM Milestones__r
                         WHERE Is_Active__c = true
                         ORDER BY CreatedDate DESC)

                    FROM Project__c
                    WHERE Is_Active__c = true
                    AND Id = :projectId
                ];
            }

            return [
                SELECT
                    Id,
                    Name,
                    Status__c,
                    Start_Date__c,
                    End_Date__c,
                    Planned_Hours__c,
                    Actual_Hours__c,

                    (SELECT
                        Id,
                        Name,
                        Allocation__c,
                        Assigned_To__c,Assigned_To__r.Name,
                        Employee_Cost__c,
                        Employee_Cost_Based_On__c,
                        End_Date__c,
                        Is_Active__c,
                        Is_Current__c,
                        Project__c,
                        Rate__c,
                        Rate_Per_Hour__c,
                        Role__c,
                        Start_Date__c
                     FROM Project_Teams__r
                     WHERE Is_Active__c = true
                     ORDER BY CreatedDate DESC),

                    (SELECT
                        Id,
                        Name,
                        Status__c,
                        Start_Date__c,
                        End_Date__c,
                        Planned_Hours__c,
                        Actual_Work_Hours__c,

                        (SELECT
                            Id,
                            Name,
                            Planned_Hours__c,
                            Actual_Hours__c,
                            Start_Date__c,
                            End_Date__c,

                            (SELECT
                                Id,
                                Name,
                                Status__c,
                                Start_Date__c,
                                End_Date__c,
                                Work_Hours__c,
                                Logged_Hours__c
                             FROM Tasks__r
                             WHERE Is_Active__c = true
                             ORDER BY CreatedDate DESC)

                         FROM Task_Lists__r
                         WHERE Is_Active__c = true
                         ORDER BY CreatedDate DESC)

                     FROM Milestones__r
                     WHERE Is_Active__c = true
                     ORDER BY CreatedDate DESC)

                FROM Project__c
                WHERE Is_Active__c = true
                ORDER BY CreatedDate DESC
            ];

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static ProjectDashboardDTO getProjectDashboardData(Id projectId) {
        if (projectId == null) {
            throw new AuraHandledException('projectId is required for dashboard data');
        }

        ProjectDashboardDTO dto = new ProjectDashboardDTO();

        // Project with related team members / structure
        List<Project__c> projects = [
            SELECT
                Id,
                Name,
                Status__c,
                Start_Date__c,
                End_Date__c,
                Planned_Hours__c,
                Actual_Hours__c,
                (SELECT
                    Id,
                    Name,
                    Allocation__c,
                    Assigned_To__c,Assigned_To__r.Name,
                    Employee_Cost__c,
                    Employee_Cost_Based_On__c,
                    End_Date__c,
                    Is_Active__c,
                    Is_Current__c,
                    Project__c,
                    Rate__c,
                    Rate_Per_Hour__c,
                    Role__c,
                    Start_Date__c
                 FROM Project_Teams__r
                 WHERE Is_Active__c = true
                 ORDER BY CreatedDate DESC),
                (SELECT
                    Id,
                    Name,
                    Status__c,
                    Start_Date__c,
                    End_Date__c,
                    Planned_Hours__c,
                    Actual_Work_Hours__c,
                    (SELECT
                        Id,
                        Name,
                        Planned_Hours__c,
                        Actual_Hours__c,
                        Start_Date__c,
                        End_Date__c,
                        (SELECT
                            Id,
                            Name,
                            Status__c,
                            Start_Date__c,
                            End_Date__c,
                            Work_Hours__c,
                            Logged_Hours__c
                         FROM Tasks__r
                         WHERE Is_Active__c = true
                         ORDER BY CreatedDate DESC)
                     FROM Task_Lists__r
                     WHERE Is_Active__c = true
                     ORDER BY CreatedDate DESC)
                 FROM Milestones__r
                 WHERE Is_Active__c = true
                 ORDER BY CreatedDate DESC)
            FROM Project__c
            WHERE Id = :projectId
            LIMIT 1
        ];

        if (!projects.isEmpty()) {
            dto.project = projects[0];
        }

        // Tasks directly under project
        dto.tasks = [
            SELECT
                Id,
                Name,
                Status__c,
                Start_Date__c,
                End_Date__c,
                Actual_Start_Date__c,
                Actual_End_Date__c
            FROM Tasks__c
            WHERE Associated_Project__c = :projectId
        ];

        // Bugs for project
        dto.bugs = [
            SELECT
                Id,
                Name,
                Status__c,
                Due_Date__c
            FROM Issue_Bug__c
            WHERE Project__c = :projectId
        ];

        // Aggregations
        Map<String, Integer> taskStatusCounts = new Map<String, Integer>();
        Map<String, Integer> bugStatusCounts = new Map<String, Integer>();

        Integer overdueTasks = 0;
        Integer todaysTasks = 0;
        Integer upcomingTasks = 0;
        Integer bugsInRetest = 0;

        Date today = Date.today();

        for (Tasks__c t : dto.tasks) {
            String st = String.valueOf(t.Status__c);
            taskStatusCounts.put(st, (taskStatusCounts.containsKey(st) ? taskStatusCounts.get(st) : 0) + 1);

            // Use End_Date__c for time buckets
            if (t.End_Date__c != null) {
                if (t.End_Date__c < today && t.Status__c != 'Completed') {
                    overdueTasks++;
                } else if (t.End_Date__c == today) {
                    todaysTasks++;
                } else if (t.End_Date__c > today) {
                    upcomingTasks++;
                }
            }
        }

        for (Issue_Bug__c b : dto.bugs) {
            String st = String.valueOf(b.Status__c);
            bugStatusCounts.put(st, (bugStatusCounts.containsKey(st) ? bugStatusCounts.get(st) : 0) + 1);
            if (st == 'In Retest') {
                bugsInRetest++;
            }
        }

        dto.totalTasks = dto.tasks != null ? dto.tasks.size() : 0;
        dto.overdueTasks = overdueTasks;
        dto.todaysTasks = todaysTasks;
        dto.upcomingTasks = upcomingTasks;
        dto.bugsInRetest = bugsInRetest;

        dto.taskStatusSummary = new List<StatusCount>();
        for (String key : taskStatusCounts.keySet()) {
            dto.taskStatusSummary.add(new StatusCount(key, taskStatusCounts.get(key)));
        }

        dto.bugStatusSummary = new List<StatusCount>();
        for (String key : bugStatusCounts.keySet()) {
            dto.bugStatusSummary.add(new StatusCount(key, bugStatusCounts.get(key)));
        }

        return dto;
    }
}