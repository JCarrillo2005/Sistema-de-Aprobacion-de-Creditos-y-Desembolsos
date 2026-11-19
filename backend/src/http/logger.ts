import { config } from "../config";

export type LogSink = (line: string) => void;

const noop: LogSink = () => {};

// En pruebas se silencia la salida; las pruebas del middleware inyectan su propio sink.
export const logSink: LogSink =
  config.env === "test"
    ? noop
    : (line) => {
        console.log(line);
      };

export const errorSink: LogSink =
  config.env === "test"
    ? noop
    : (line) => {
        console.error(line);
      };
