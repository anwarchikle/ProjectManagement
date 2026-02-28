/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : QaViewDashboardController
 * Author          : <YourName>
 * Created Date    : Feb 26, 2026
 * Last Modified By: <YourName>
 * Last Modified On: Feb 26, 2026
 * Description     : Apex controller for QA View Dashboard — Command Center
 *                   and Multi-Project Quality View tabs.
 *
 * Change History  :
 *  Date          │   Author     │   Change
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Feb 26, 2026  │ <YourName>   │ Initial version
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */
public with sharing class QaViewDashboardController {

    /* ════════════════════════════════════════════════════════════════════════
     * COMMAND CENTER
     * ════════════════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getCommandCenterData() {
        Id   currentUserId = UserInfo.getUserId();
        Date today         = Date.today();

        // Start-of-day 5 days ago — matches LAST_N_DAYS:5 behaviour
        DateTime stuckThreshold = DateTime.newInstance(today.addDays(-5), Time.newInstance(0, 0, 0, 0));

        // 1. Bugs pending QA verification
        Integer pendingQaCount = [
            SELECT COUNT() FROM Issue_Bug__c
            WHERE CreatedById = :currentUserId AND Status__c = 'In Retest'
        ];

        // 2. Bugs due today
        Integer dueTodayCount = [
            SELECT COUNT() FROM Issue_Bug__c
            WHERE CreatedById = :currentUserId AND Due_Date__c = :today
        ];

        // 3. SLA breached (Critical severity)
        Integer slaBreachedCount = [
            SELECT COUNT() FROM Issue_Bug__c
            WHERE CreatedById = :currentUserId AND Severity__c = 'Critical'
        ];

        // 4. Test execution due — ALL for count, LWC shows first 10
        List<Issue_Bug__c> testExecBugs = [
            SELECT Id, Issue_Id__c, Name, Status__c, CreatedBy.Name,
                   Project__c, Project__r.Name
            FROM   Issue_Bug__c
            WHERE  CreatedById = :currentUserId AND Status__c = 'To be Tested'
            ORDER BY CreatedDate ASC
        ];

        List<Map<String, Object>> testExecutionRecords = new List<Map<String, Object>>();
        for (Issue_Bug__c bug : testExecBugs) {
            testExecutionRecords.add(new Map<String, Object>{
                'id'          => bug.Id,
                'issueId'     => bug.Issue_Id__c,
                'title'       => bug.Name,
                'status'      => bug.Status__c,
                'owner'       => bug.CreatedBy.Name,
                'projectId'   => bug.Project__c,
                'projectName' => bug.Project__r != null ? bug.Project__r.Name : ''
            });
        }

        // 5. Stuck bugs — ALL for count, LWC shows first 10
        List<Issue_Bug__c> stuckBugs = [
            SELECT Id, Issue_Id__c, Name, Status__c, Severity__c,
                   Assignee__r.Name, Project__c, Project__r.Name,
                   CreatedDate, LastModifiedDate
            FROM   Issue_Bug__c
            WHERE  CreatedById = :currentUserId AND LastModifiedDate < :stuckThreshold
            ORDER BY LastModifiedDate ASC
        ];

        List<Map<String, Object>> stuckBugRecords = new List<Map<String, Object>>();
        for (Issue_Bug__c bug : stuckBugs) {
            Integer ageDays   = bug.CreatedDate.date().daysBetween(today);
            Integer stuckDays = bug.LastModifiedDate.date().daysBetween(today);
            stuckBugRecords.add(new Map<String, Object>{
                'id'          => bug.Id,
                'issueId'     => bug.Issue_Id__c,
                'title'       => bug.Name,
                'severity'    => bug.Severity__c,
                'status'      => bug.Status__c,
                'assignee'    => bug.Assignee__r != null ? bug.Assignee__r.Name : '',
                'projectId'   => bug.Project__c,
                'projectName' => bug.Project__r != null ? bug.Project__r.Name : '',
                'ageDays'     => ageDays,
                'stuckDays'   => stuckDays
            });
        }

        return new Map<String, Object>{
            'pendingQaCount'       => pendingQaCount,
            'dueTodayCount'        => dueTodayCount,
            'slaBreachedCount'     => slaBreachedCount,
            'testExecutionCount'   => testExecBugs.size(),
            'stuckCount'           => stuckBugs.size(),
            'testExecutionRecords' => testExecutionRecords,
            'stuckBugRecords'      => stuckBugRecords
        };
    }

    /* ════════════════════════════════════════════════════════════════════════
     * MULTI-PROJECT QUALITY VIEW
     * ════════════════════════════════════════════════════════════════════════ */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getMultiProjectQualityData() {
        Id   currentUserId = UserInfo.getUserId();
        Date today         = Date.today();

        // ── Chart: bugs grouped by Project × Severity (created by current user) ──
        // Returns actual Severity__c picklist values — not hardcoded S1/S2/S3
        List<AggregateResult> severityByProject = [
            SELECT Project__r.Name projectName,
                   Severity__c     severity,
                   COUNT(Id)        bugCount
            FROM   Issue_Bug__c
            WHERE  CreatedById = :currentUserId
              AND  Project__c  != null
              AND  Severity__c != null
            GROUP BY Project__r.Name, Severity__c
            ORDER BY Project__r.Name
        ];

        // Build map: projectName → { severities: { 'S1': 2, 'S2': 1, ... } }
        Map<String, Map<String, Integer>> chartMap = new Map<String, Map<String, Integer>>();
        for (AggregateResult ar : severityByProject) {
            String  proj  = (String)  ar.get('projectName');
            String  sev   = (String)  ar.get('severity');
            Integer cnt   = (Integer) ar.get('bugCount');
            if (proj == null || sev == null) continue;
            if (!chartMap.containsKey(proj)) {
                chartMap.put(proj, new Map<String, Integer>());
            }
            chartMap.get(proj).put(sev, cnt);
        }

        // Convert to list for LWC — each item has project + severities map
        List<Map<String, Object>> chartData = new List<Map<String, Object>>();
        for (String proj : chartMap.keySet()) {
            // Convert inner Map<String,Integer> to Map<String,Object> for serialization
            Map<String, Object> sevAsObj = new Map<String, Object>();
            for (String sev : chartMap.get(proj).keySet()) {
                sevAsObj.put(sev, chartMap.get(proj).get(sev));
            }
            chartData.add(new Map<String, Object>{
                'project'    => proj,
                'severities' => sevAsObj
            });
        }

        // ── Defect Backlog Size per project ──────────────────────────────────────
        // Open count per project
        List<AggregateResult> openByProject = [
            SELECT Project__r.Name projectName, COUNT(Id) cnt
            FROM   Issue_Bug__c
            WHERE  CreatedById = :currentUserId
              AND  Status__c   = 'Open'
              AND  Project__c  != null
            GROUP BY Project__r.Name
        ];

        // In Progress count per project
        List<AggregateResult> inProgressByProject = [
            SELECT Project__r.Name projectName, COUNT(Id) cnt
            FROM   Issue_Bug__c
            WHERE  CreatedById = :currentUserId
              AND  Status__c   = 'In Progress'
              AND  Project__c  != null
            GROUP BY Project__r.Name
        ];

        // Total Backlog: Due_Date__c is in past AND Status != 'Completed'
        List<AggregateResult> backlogByProject = [
            SELECT Project__r.Name projectName, COUNT(Id) cnt
            FROM   Issue_Bug__c
            WHERE  CreatedById = :currentUserId
              AND  Due_Date__c < :today
              AND  Status__c  != 'Completed'
              AND  Project__c != null
            GROUP BY Project__r.Name
        ];

        // Merge into single project map
        Map<String, Map<String, Object>> projectMap = new Map<String, Map<String, Object>>();

        for (AggregateResult ar : openByProject) {
            String proj = (String) ar.get('projectName');
            if (proj == null) continue;
            if (!projectMap.containsKey(proj)) projectMap.put(proj, newProjectRow(proj));
            projectMap.get(proj).put('openCount', (Integer) ar.get('cnt'));
        }
        for (AggregateResult ar : inProgressByProject) {
            String proj = (String) ar.get('projectName');
            if (proj == null) continue;
            if (!projectMap.containsKey(proj)) projectMap.put(proj, newProjectRow(proj));
            projectMap.get(proj).put('inProgressCount', (Integer) ar.get('cnt'));
        }
        for (AggregateResult ar : backlogByProject) {
            String proj = (String) ar.get('projectName');
            if (proj == null) continue;
            if (!projectMap.containsKey(proj)) projectMap.put(proj, newProjectRow(proj));
            projectMap.get(proj).put('totalBacklog', (Integer) ar.get('cnt'));
        }

        // Compute severity-weighted score per project using actual picklist values
        // Weight map: adjust keys to match your actual Severity__c picklist values
        Map<String, Integer> weightMap = new Map<String, Integer>{
            'S1' => 10, 'S2' => 5, 'S3' => 2, 'S4' => 1, 'S5' => 1,
            'Critical' => 10, 'High' => 5, 'Medium' => 2, 'Low' => 1
        };
        for (String proj : projectMap.keySet()) {
            Integer score = 0;
            if (chartMap.containsKey(proj)) {
                for (String sev : chartMap.get(proj).keySet()) {
                    Integer weight = weightMap.containsKey(sev) ? weightMap.get(sev) : 1;
                    score += chartMap.get(proj).get(sev) * weight;
                }
            }
            projectMap.get(proj).put('score', score);
        }

        List<Map<String, Object>> backlogRows = new List<Map<String, Object>>(projectMap.values());

        // ── Overall severity-weighted score ──────────────────────────────────────
        List<AggregateResult> allSeverity = [
            SELECT Severity__c severity, COUNT(Id) cnt
            FROM   Issue_Bug__c
            WHERE  CreatedById = :currentUserId
              AND  Status__c   = 'Open'
            GROUP BY Severity__c
        ];
        Map<String, Integer> weightMap2 = new Map<String, Integer>{
            'S1' => 10, 'S2' => 5, 'S3' => 2, 'S4' => 1, 'S5' => 1,
            'Critical' => 10, 'High' => 5, 'Medium' => 2, 'Low' => 1
        };
        Integer overallScore = 0;
        for (AggregateResult ar : allSeverity) {
            String  sev    = (String)  ar.get('severity');
            Integer cnt    = (Integer) ar.get('cnt');
            Integer weight = (sev != null && weightMap2.containsKey(sev)) ? weightMap2.get(sev) : 1;
            overallScore  += cnt * weight;
        }

        // ── Escaped Defects (UAT / Production) ───────────────────────────────────
        List<Issue_Bug__c> escapedBugs = [
            SELECT Id, Issue_Id__c, Name, Severity__c, Status__c,
                   Assignee__r.Name, Project__c, Project__r.Name, CreatedDate
            FROM   Issue_Bug__c
            WHERE  CreatedById     = :currentUserId
              AND  Environment__c IN ('UAT', 'Production')
            ORDER BY CreatedDate DESC
        ];

        List<Map<String, Object>> escapedRecords = new List<Map<String, Object>>();
        for (Issue_Bug__c bug : escapedBugs) {
            Integer ageDays = bug.CreatedDate.date().daysBetween(today);
            escapedRecords.add(new Map<String, Object>{
                'id'          => bug.Id,
                'issueId'     => bug.Issue_Id__c,
                'title'       => bug.Name,
                'severity'    => bug.Severity__c,
                'status'      => bug.Status__c,
                'assignee'    => bug.Assignee__r != null ? bug.Assignee__r.Name : '',
                'projectId'   => bug.Project__c,
                'projectName' => bug.Project__r != null ? bug.Project__r.Name : '',
                'ageDays'     => ageDays
            });
        }

        return new Map<String, Object>{
            'chartData'      => chartData,
            'backlogRows'    => backlogRows,
            'overallScore'   => overallScore,
            'escapedRecords' => escapedRecords
        };
    }

    // Helper: blank project row
    private static Map<String, Object> newProjectRow(String proj) {
        return new Map<String, Object>{
            'projectName'     => proj,
            'openCount'       => 0,
            'inProgressCount' => 0,
            'totalBacklog'    => 0,
            'score'           => 0
        };
    }
}