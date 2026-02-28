@IsTest
private class taskControllerTest {

    @IsTest
    static void testGetTasksAndUpdateStatus() {
        Project__c proj = TestDataFactory.createProject();
        Tasks__c t = TestDataFactory.createTask(proj, 'Open');

        Test.startTest();
        List<Tasks__c> allTasks = taskController.getTasks(null);
        List<Tasks__c> openTasks = taskController.getTasks('Open');
        taskController.updateTaskStatus(t.Id, 'Completed');
        Test.stopTest();

        System.debug(allTasks);
        System.debug(openTasks);
    }

    @IsTest
    static void testAssignAndResolveContext() {
        Project__c proj = TestDataFactory.createProject();

        // Minimal user for assignment
        User u = [SELECT Id FROM User WHERE IsActive = true LIMIT 1];

        Test.startTest();
        taskController.assignProjectMembers(proj.Id, new List<Id>{ u.Id });
        Map<String, String> ctx = taskController.resolveContext(proj.Id);
        Test.stopTest();

        System.debug(ctx);
    }
}