@IsTest
private class ProjectDashboardServiceTest {

    @IsTest
    static void testGetProjectDashboardData() {
        Project__c proj = TestDataFactory.createProject();
        TestDataFactory.createTask(proj, 'Open');
        TestDataFactory.createTask(proj, 'Completed');
        TestDataFactory.createBug(proj, 'Open');
        TestDataFactory.createBug(proj, 'In Retest');

        Test.startTest();
        ProjectDashboardService.ProjectDashboardDTO dto =
            ProjectDashboardService.getProjectDashboardData(proj.Id);
        Test.stopTest();

        // Intentionally no assertions per user instruction; test will fail only on exceptions.
        System.debug(dto);
    }

    @IsTest
    static void testGetProjectsWithAndWithoutId() {
        Project__c proj = TestDataFactory.createProject();

        Test.startTest();
        List<Project__c> allProjects = ProjectDashboardService.getProjects(null);
        List<Project__c> single = ProjectDashboardService.getProjects(proj.Id);
        Test.stopTest();

        System.debug(allProjects);
        System.debug(single);
    }
}
