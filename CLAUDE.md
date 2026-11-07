# Crew

The plugin's code is in `plugins/crew`; how to try, test and release it is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Project, the sibling plugin

Crew and [Project](https://github.com/stefanocaronia/claude-project) are sibling plugins, separate and complementary: Project keeps the work (plan, tasks, decisions), Crew the colleagues who do it. They must always stay compatible, each working alone and both together:

- A change to what one reads or writes of the other (Project's configuration keys, the backlog's commands and their options, the folders under the docs, the colleagues' files) is agreed with Project's side first, and lands in both, released together when it breaks the other.
- The contract between them is written in both guides, in the same words: what each reads and writes of the other, and the folders they share.
- Before a release, check that the released Project still works with it: Crew's calls of `backlog.mjs`, and the files it reads.
