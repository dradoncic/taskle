https://github.com/user-attachments/assets/32aac5dd-35bb-4fc7-95d0-67821da59383


# Taskle

Taskle is a Visual Studio Code extension designed to help you break down tasks into smaller, manageable subtasks with the help of OpenAI's GPT API. It offers a seamless task management experience right from your editor's sidebar.

## Features

- **Task Breakdown**: Enter a task and let OpenAI's API break it into subtasks.
- **Magic Wand Toggle**: Toggle between manual task addition or auto-task breakdown mode.
- **Task List Management**: Add, delete, and clear tasks effortlessly.
- **Reordering**: Planned drag-and-drop reordering of tasks.
- **Depth Control**: Adjust the granularity of task breakdown with a range slider.
- **Persistence**: Tasks are saved globally within VS Code.

## Getting Started

### Prerequisites
- Visual Studio Code
- Node.js (for development)
- OpenAI API Key

### Installation
1. Clone the repository:
    ```bash
    git clone <repository-url>
    ```
2. Open the project in Visual Studio Code.
3. Install dependencies:
    ```bash
    npm install
    ```
4. Build the extension:
    ```bash
    npm run build
    ```
5. Press `F5` in VS Code to start debugging the extension.

### Setting Up
1. On first use, you will be prompted to enter your OpenAI API key. If not prompted, you can manually set it:
    - Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS).
    - Search for "Taskle: Set OpenAI API Key" and enter your API Key.
2. Once the API Key is validated, you're ready to start managing your tasks!

## Usage
1. Open the Taskle sidebar from the activity bar.
2. Enter a task and click the **Magic Wand** button to use the auto-breakdown feature.
3. Adjust the depth of subtasks using the range slider.
4. Add or manage tasks manually if desired.

## Configuration
Taskle uses VS Code's settings to store tasks:
- `taskle.tasks`: Stores the list of tasks globally.

## Development
### Folder Structure
- `src/`: Contains the TypeScript source code.
- `media/`: Holds CSS, images, and other assets for the webview.

### Adding Features
1. Extend the `UIProvider` class for new webview functionality.
2. Update `extension.ts` to register new commands or views.

### Testing
Run the extension in a development environment:
```bash
npm run test
```

## Known Issues
- Drag-and-drop reordering of tasks is currently under development.
- Task breakdowns may occasionally exceed the desired depth.

## Contributing
Contributions are welcome! Fork the repository and create a pull request with your proposed changes.

## License
This project is licensed under the MIT License.

---

Happy Task Management with **Taskle**!



