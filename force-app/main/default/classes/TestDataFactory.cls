@IsTest
public class TestDataFactory {

    public static Project__c createProject() {
        Project__c proj = new Project__c(
            Name = 'Test Project',
            Status__c = 'Active',
            Start_Date__c = Date.today().addDays(-7),
            End_Date__c = Date.today().addDays(7),
            Is_Active__c = true
        );
        insert proj;
        return proj;
    }

    public static Tasks__c createTask(Project__c proj, String status) {
        if (proj == null) {
            proj = createProject();
        }
        Tasks__c t = new Tasks__c(
            Name = 'Test Task',
            Associated_Project__c = proj.Id,
            Status__c = status,
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(1)
        );
        insert t;
        return t;
    }

    public static Issue_Bug__c createBug(Project__c proj, String status) {
        if (proj == null) {
            proj = createProject();
        }
        Issue_Bug__c bug = new Issue_Bug__c(
            Name = 'Test Bug',
            Project__c = proj.Id,
            Status__c = status,
            Due_Date__c = Date.today().addDays(3)
        );
        insert bug;
        return bug;
    }
}