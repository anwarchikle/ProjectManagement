// File: classes/TimeHierarchyRollupJob.cls
public class TimeHierarchyRollupJob implements Queueable {
    private Set<Id> taskListIds;
    private Set<Id> milestoneIds;
    private Set<Id> projectIds;

    public TimeHierarchyRollupJob(
        Set<Id> taskListIds,
        Set<Id> milestoneIds,
        Set<Id> projectIds
    ) {
        this.taskListIds = taskListIds == null ? new Set<Id>() : new Set<Id>(taskListIds);
        this.milestoneIds = milestoneIds == null ? new Set<Id>() : new Set<Id>(milestoneIds);
        this.projectIds = projectIds == null ? new Set<Id>() : new Set<Id>(projectIds);
    }

    public void execute(QueueableContext qc) {
        if (!taskListIds.isEmpty()) {
            TimeHierarchyRollupService.rollupFromTaskLists(taskListIds);
        }
        if (!milestoneIds.isEmpty()) {
            TimeHierarchyRollupService.rollupFromMilestones(milestoneIds);
        }
        if (!projectIds.isEmpty()) {
            TimeHierarchyRollupService.rollupProjects(projectIds);
        }
    }
}