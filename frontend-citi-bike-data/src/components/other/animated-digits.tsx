import classNames from "classnames";
import { useState, useRef, useEffect } from "react";

interface AnimatedDigitProps {
  digit: string;
  index: number;
  animationKey: number;
}

const AnimatedDigit: React.FC<AnimatedDigitProps> = ({
  digit,
  index,
  animationKey,
}) => {
  return (
    <span
      key={`${animationKey}-${index}`}
      className={classNames(
        "inline-block",
        "animate-[slideDown_0.3s_ease-out_forwards] opacity-0",
      )}
      style={{
        animationDelay: `${index * 30}ms`,
      }}
    >
      {digit}
    </span>
  );
};

interface AnimatedNumberProps {
  value: string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  className,
}) => {
  const [animationKey, setAnimationKey] = useState(0);
  const previousValueRef = useRef(value);

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
    previousValueRef.current = value;
  }, [value]);

  const formattedNumber = value.toLocaleString();
  const digits = formattedNumber.split("");

  return (
    <span
      className={classNames("tabular-nums tracking-wider", className)}
    >
      {digits.map((digit, index) => (
        <AnimatedDigit
          key={`${animationKey}-${index}`}
          digit={digit}
          index={index}
          animationKey={animationKey}
        />
      ))}
    </span>
  );
};
