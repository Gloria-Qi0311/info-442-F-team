# INFO 442 — Team F

Course project repository for INFO 442 (Cooperative Software Development), University of Washington.

## Team Members

| Name | Role |
| --- | --- |
| Harry Han | Developer |
| Jessie Zhuang | Product Designer |
| Ling Wang | Developer |
| Peitong Qi | Developer |
| Stella Sun | Product Manager |

## Skills and Competencies

The skills and competencies used to measure each member's performance, based on their role on the team.

| Everyone | Developer | Designer | PM |
| --- | --- | --- | --- |
| Communicates clearly and on time with the team | Writes clear, maintainable, well-organized code | Researches users and their needs | Defines the problem, goals, and project scope |
| Meets commitments and deadlines | Makes sound technical and architecture decisions | Turns user needs into design requirements | Plans milestones and tracks team progress |
| Gives and receives constructive feedback | Uses version control and code review effectively | Creates sketches, wireframes, and prototypes | Prioritizes features and manages trade-offs |
| Contributes to team decisions and resolves conflict respectfully | Tests and verifies that code works correctly | Evaluates designs through usability testing | Facilitates meetings and team communication |
| Documents work so others can understand it | Estimates and breaks down development tasks | Communicates design decisions to developers | Communicates with stakeholders and verifies requirements are met |

**Our roles:** Harry Han (Developer), Jessie Zhuang (Designer), Ling Wang (Developer), Peitong Qi (Developer), Stella Sun (PM). Everyone is also measured on the "Everyone" column.

## Team Mission

We help UW students find, borrow, and exchange everyday items within their campus community, making it easier to reuse belongings and reduce unnecessary purchases.

## Team Documentation

[Team Notion Workspace](https://app.notion.com/p/INFO-442-F-Team-a6a34f64765c4ef9ae21a4f4bf14be42)

## Design Specifications
[Specifications (Notion)](https://app.notion.com/p/Specifications-3fe154ba926580988afddd9ec88309ea)


## Development Setup

See [SETUP.md](SETUP.md) for how to run the app and connect Firebase.

## Testing Plan
[Testing Plan (Notion)](https://app.notion.com/p/Testing-Plan-414154ba9265809089b9eef529f0b687?source=copy_link)

## Quality

### Accessibility

We used semantic HTML, including headings, navigation, and native
buttons and form controls. Form fields have labels, and validation
messages explain which information is missing or invalid. Item
photos also have descriptive alternative text.

Request statuses and transaction stages are shown in text, so users
do not have to rely on color alone to understand their progress.
These choices follow the accessibility topics discussed in class,
especially text alternatives and input assistance.

### Security

Husky Share uses Firebase Authentication and Firestore Security
Rules to limit data access to users with verified UW email
addresses. The rules also check ownership and transaction roles:
only listing owners can approve requests, and only participants
can access their transactions.

We display users' names without showing their UW email addresses
to other users. Related transaction updates are saved together,
and points cannot be awarded twice for the same transaction.
We tested these protections locally with Firebase Emulators,
including unauthorized access and delayed submissions.

### Responsiveness

We used responsive layouts for the map, forms, listings, and
transaction pages. We checked 16 representative page templates
at six widths between 375px and 1440px. None of these checks
showed horizontal scrolling.

These checks cover the page states we tested. We also ran
Lighthouse, WAVE, and VoiceOver on the map, listing detail,
account, and post pages. They reported no accessibility errors.
The evidence for all ten nonfunctional requirements is in
[NONFUNCTIONAL_EVIDENCE.md](NONFUNCTIONAL_EVIDENCE.md).
