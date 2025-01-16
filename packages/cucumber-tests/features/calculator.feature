Feature: Calculator
  As a user
  I want to perform basic arithmetic operations
  So that I can get accurate calculations

  Scenario: Adding two numbers
    Given I have entered 5 into the calculator
    And I have entered 7 into the calculator
    When I press add
    Then the result should be 12

#  Scenario: Subtracting two numbers
#    Given I have entered 10 into the calculator
#    And I have entered 4 into the calculator
#    When I press subtract
#    Then the result should be 6
#
#  Scenario: Multiplying two numbers
#    Given I have entered 6 into the calculator
#    And I have entered 3 into the calculator
#    When I press multiply
#    Then the result should be 18