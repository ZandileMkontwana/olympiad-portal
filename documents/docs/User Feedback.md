---
sidebar_label: User Feedback
---
# User Feedback and Improvements

## 1. User Testing

User testing was conducted using a [Google Form](https://docs.google.com/forms/d/1dxk_rId1HTc_OBikehMt0cKw5YKiiYK8ZWuwjRO7kak/edit#responses) to gather feedback from **15 users** who interacted with different areas of the Olympiad Portal. The questionnaire covered overall usability, feature-specific experiences, navigation, unexpected behaviour, and suggestions for improvement.

Users tested a variety of portal functionality, including:

| Portal Functionality | Users |
|---|---:|
| Uploading or downloading a paper | 6 |
| Setting up/managing a round | 5 |
| Submitting results | 5 |
| Sitting a test online | 5 |
| Viewing standings/results | 5 |
| Marking or reviewing an appeal | 4 |
| Adding a student to an olympiad | 1 |

This provided feedback across the main user workflows of the system, including organiser, educator, and student interactions.

---

## 2. Usability Feedback

The overall usability results were positive. When asked to rate how easy the portal was to use on a scale from 1 to 5:

- **9 users (60%)** rated the portal **5/5**.
- **4 users (26.7%)** rated it **4/5**.
- **2 users (13.3%)** rated it **3/5**.
- No users rated the portal 1/5 or 2/5.

Therefore, **13 out of 15 users (86.7%) rated the portal 4 or 5**, indicating that the main workflows were generally easy to understand and use.

Users were also asked whether they became stuck or were unsure what to do next. Most users indicated that they were able to navigate the system without difficulty. However, several usability concerns were identified, particularly around the user interface, navigation consistency, and understanding which Olympiad students belonged to.

---

## 3. Feature-Specific Feedback

### 3.1 Test and Result Submission

Users who submitted results or sat an online test generally found the process clear and reliable.

| Rating | Responses |
|---|---:|
| 1 | 0 |
| 2 | 0 |
| 3 | 2 |
| 4 | 5 |
| 5 | 3 |

**80% of respondents rated this process 4 or 5.**

Positive comments described the process as straightforward, with clear instructions and an easy-to-navigate dashboard.

However, users identified an important functional issue: **students were able to proceed to the next round without satisfying the qualification requirements**. This was treated as a functional issue rather than only a UI concern.

### 3.2 Standings and Results

Users who viewed standings or results also provided generally positive feedback.

| Rating | Responses |
|---|---:|
| 1 | 0 |
| 2 | 0 |
| 3 | 3 |
| 4 | 4 |
| 5 | 4 |

**72.7% of respondents rated the standings/results experience 4 or 5.**

Users indicated that the information was clear and organised, and that the results displayed were correct. However, multiple users reported that pages containing results could take a while to load.

---

## 4. Issues Identified from Feedback

The open-ended responses revealed several recurring areas for improvement.

| Feedback Theme | Evidence from Users | Identified Improvement |
|---|---|---|
| Small font size | Users requested that the font be increased | Improve font sizing and readability |
| General UI | Several users requested UI improvements or polishing | Refine interface layout and visual presentation |
| Page loading time | Users reported delays when moving between pages | Improve page response and loading performance |
| Student/Olympiad association | Educators could not easily identify which Olympiad a student belonged to | Organise students according to their Olympiads |
| Adding students | Users wanted to specify the Olympiad when adding a student | Allow the Olympiad to be selected during student registration |
| Round progression | Students could continue to another round without qualifying | Implement qualification-based round restrictions |
| Organiser access | Organisers could access Olympiads created by other organisers | Restrict access to owned or shared Olympiads |
| Organiser collaboration | Users requested the ability to work with other organisers | Support adding co-organisers to an Olympiad |
| Navigation consistency | Users reported inconsistencies when logging out or returning to previous pages | Improve navigation and logout behaviour |

---

## 5. Implemented Improvements

The feedback was reviewed and converted into concrete system improvements. The following changes were implemented based directly on the issues raised during user testing.

### 5.1 Qualification-Based Round Access

Users identified that students could access the next round without first qualifying. The round progression logic was updated so that access to subsequent rounds is controlled according to the qualification requirements.

This ensures that the system's workflow corresponds more closely to the intended Olympiad progression.

### 5.2 Improved Student Organisation

Educators reported difficulty identifying which Olympiad a student belonged to. The educator interface was updated to provide clearer organisation of students according to their associated Olympiads.

This addresses the feedback that students were difficult to distinguish when an educator was managing multiple Olympiads.

### 5.3 Olympiad Selection When Adding Students

Users indicated that adding a student did not clearly identify the Olympiad to which the student was being added. The student registration workflow was improved to allow the relevant Olympiad to be specified during the process.

This makes the relationship between students and Olympiads explicit and reduces ambiguity for educators.

### 5.4 Organiser Access Control

A significant security-related concern was raised when a user reported being able to access Olympiads created by other organisers. The access-control logic was reviewed and updated so that organisers can access Olympiads they created or Olympiads to which they have explicitly been granted access.

This also supports collaboration between multiple organisers while maintaining controlled access.

### 5.5 Co-Organiser Functionality

One of the open-ended responses specifically suggested that an organiser should be able to add other organisers when multiple people are responsible for running an Olympiad.

The portal was therefore extended to support **co-organiser access**, allowing organisers to collaborate on an Olympiad while maintaining controlled access.

### 5.6 UI Improvements

Several users requested improvements to the user interface, including increasing the font size and improving the general organisation and appearance of the portal.

The interface was refined to improve readability, organisation, and consistency across the main user workflows.

### 5.7 Navigation Improvements

Feedback highlighted inconsistencies when logging out and navigating back to previous pages. These interactions were reviewed and improved to provide a more consistent navigation experience.

### 5.8 Performance Improvements

Multiple users reported that pages, particularly when moving between pages or loading results, could take some time to respond.

The system was reviewed with performance and response time in mind, with improvements made to reduce unnecessary delays in the user experience.

---

## 6. Feedback-to-Implementation Traceability

The following table demonstrates how user feedback was translated into implemented system changes.

| User Feedback | System Response |
|---|---|
| "The font is quite small" | Improved UI typography and readability |
| "The UI needs some improvement" | Refined the portal's interface and layout |
| "The response time could be improved" | Optimised page loading and response behaviour |
| Students can continue without qualifying | Added qualification-based round restrictions |
| Cannot tell which Olympiad a student belongs to | Improved student organisation by Olympiad |
| Cannot specify the Olympiad when adding a student | Added Olympiad selection to the student-adding workflow |
| Organisers can access other organisers' Olympiads | Implemented organiser access restrictions |
| Multiple organisers may need to manage one Olympiad | Implemented co-organiser functionality |
| Logout/back navigation is inconsistent | Improved navigation behaviour |

---

## 7. Outcome

The user testing process provided both **quantitative and qualitative evidence** of how users interacted with the portal. The quantitative results showed generally positive usability, while the open-ended responses identified specific functional, usability, access-control, and performance issues.

Importantly, the feedback was not only collected but was used to guide subsequent development. Issues identified by users were translated into implemented changes, including:

- Qualification-based round progression
- Improved student organisation
- Olympiad selection when adding students
- Organiser access control
- Co-organiser functionality
- UI improvements
- Navigation improvements
- Performance optimisation

This demonstrates an iterative development process in which **user and stakeholder feedback directly informed the continued improvement of the Olympiad Portal**.