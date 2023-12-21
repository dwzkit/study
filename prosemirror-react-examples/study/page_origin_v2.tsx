"use client";
import Editor from "../../components/editor/editor/editorYjs/editor";
import {
  useFloating,
  useTransitionStyles,
  offset,
  shift,
  flip,
  autoUpdate,
  inline,
} from "@floating-ui/react";
import { useState, useCallback, useEffect } from "react";

export default function Home() {
  const [openStatus, setOpenStatus] = useState(false);
  const { refs, floatingStyles, context, middlewareData } = useFloating({
    open: openStatus,
    onOpenChange: setOpenStatus,
    placement: "top",
    middleware: [offset(10), shift(), flip(), inline()],
    whileElementsMounted: autoUpdate,
  });

  const ARROW_WIDTH = 30;
  const ARROW_HEIGHT = 0;
  const arrowX = middlewareData.arrow?.x ?? 0;
  const arrowY = middlewareData.arrow?.y ?? 0;
  const transformX = arrowX + ARROW_WIDTH / 2;
  const transformY = arrowY + ARROW_HEIGHT;

  const { isMounted, styles } = useTransitionStyles(context, {
    // Configure both open and close durations:
    duration: {
      open: 200,
      close: 200,
    },
    initial: {
      transform: "scale(0)",
    },
    common: ({ side }) => ({
      transformOrigin: {
        top: `${transformX}px calc(100% + ${ARROW_HEIGHT}px)`,
        bottom: `${transformX}px ${-ARROW_HEIGHT}px`,
        left: `calc(100% + ${ARROW_HEIGHT}px) ${transformY}px`,
        right: `${-ARROW_HEIGHT}px ${transformY}px`,
      }[side],
    }),
  });

  const saveHandler = (content: any) => {
    console.log("就是测试一下", content);
  };

  const [selectionRange, setSelectionRange] = useState<any>(null);

  const selectionRangeHandler = useCallback((selectionRange: any) => {
    console.log("selectionRange", selectionRange);
    setSelectionRange(selectionRange);
    // if (selectionRange === null) {
    //   setOpenStatus(false);
    //   return;
    // }
    // refs.setReference(selectionRange);
    // // 延迟，等待floating元素渲染完成
    // setTimeout(() => {
    //   setOpenStatus(true);
    // }, 0);
  }, []);

  useEffect(() => {
    if (selectionRange === null) {
      setOpenStatus(false);
      return;
    }
    refs.setReference(selectionRange);
    // 延迟，等待floating元素渲染完成
    setTimeout(() => {
      setOpenStatus(true);
    }, 0);
  }, [selectionRange]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-24 border border-black gap-4">
      {/* <Editor onSave={saveHandler} onSelectionRange={selectionRangeHandler} /> */}

      {openStatus && isMounted && (
        <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 100 }}>
          {/* 浮动元素的内容 */}
          <div
            style={{
              ...styles,
              border: "1px solid red",
            }}
          >
            <button
              className="bg-white border border-gray-300 p-2 bg-pink-50"
              style={{
                pointerEvents: "none",
              }}
            >
              浮动元素
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
