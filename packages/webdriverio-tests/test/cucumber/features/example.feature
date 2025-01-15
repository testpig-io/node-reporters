Feature: Example Feature
  As a user
  I want to test basic functionality
  So that I can verify the system works

  Scenario: BDD - Opening WebdriverIO website
    When I visit the WebdriverIO website
    Then I should see "WebdriverIO" in the title

  Scenario: BDD - Basic assertions
    Then basic assertions should pass

  Scenario: BDD - Async operations
    Then async operations should work

  Scenario: BDD - Fail test
    Then the test should fail