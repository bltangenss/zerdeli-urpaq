import { emitKeypressEvents } from "node:readline";
import bcrypt from "bcryptjs";
import { assertAdminPassword } from "./setup-validation";

async function main() {
  if (!process.stdin.isTTY) throw new Error("Бұл команданы интерактивті терминалда іске қосыңыз");
  const password = await readHidden("Әкімші құпиясөзін енгізіңіз: ");
  assertAdminPassword(password);
  const confirmation = await readHidden("Құпиясөзді қайталаңыз: ");
  if (password !== confirmation) throw new Error("Құпиясөздер сәйкес емес");
  console.log(await bcrypt.hash(password, 12));
}

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    process.stdout.write(prompt);
    emitKeypressEvents(input);
    const wasRaw = input.isRaw;
    input.setRawMode?.(true);
    input.resume();
    let value = "";

    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      input.setRawMode?.(Boolean(wasRaw));
      input.pause();
      input.off("keypress", onKeypress);
      input.off("error", onError);
      input.off("end", onEnd);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onKeypress = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") return finish(new Error("Тоқтатылды"));
      if (key.ctrl && key.name === "d") return finish(new Error("Енгізу аяқталды"));
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.name === "backspace") {
        value = [...value].slice(0, -1).join("");
        return;
      }
      if (character && !key.ctrl) value += character;
    };
    const onError = () => finish(new Error("Құпиясөзді оқу қатесі"));
    const onEnd = () => finish(new Error("Енгізу аяқталды"));
    input.on("keypress", onKeypress);
    input.once("error", onError);
    input.once("end", onEnd);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Hash жасау қатесі");
  process.exitCode = 1;
});
