// A conversation with the colleagues: who is in it (members.ts), and a reply read turn by turn, each with its speaker (segments.ts).
export { noteSpeakers, recentlyAsked, refreshMeeting, setMeeting } from "./members.ts";
export { type Segment, segmentsOf, speakersOf, withoutClaudeMark } from "./segments.ts";
