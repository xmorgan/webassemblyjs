// @flow
const { assert } = require("chai");

const { Memory } = require("../../../../lib/interpreter/runtime/values/memory");
const t = require("../../../../lib/compiler/AST");
const {
  executeStackFrame
} = require("../../../../lib/interpreter/kernel/exec");
const {
  createStackFrame
} = require("../../../../lib/interpreter/kernel/stackframe");

describe("kernel exec - store / load instructions", () => {
  let linearMemory;
  let allocator;
  let originatingModule;

  const PAGE_SIZE = Math.pow(2, 16);
  const PAGES = 2;
  const I32_SIZE = 4;

  beforeEach(() => {
    linearMemory = new Memory({ initial: PAGES, maximum: 1024 });

    originatingModule = {
      memaddrs: [linearMemory]
    };

    allocator = {
      get() {
        return linearMemory;
      }
    };
  });

  it("should correctly store i32 values", () => {
    const code = [
      t.objectInstruction("const", "i32", [t.numberLiteral(12)]),
      t.objectInstruction("const", "i32", [t.numberLiteral(0x70000000)]),
      t.objectInstruction("store", "i32")
    ];

    const args = [];

    const stackFrame = createStackFrame(
      code,
      args,
      originatingModule,
      allocator
    );
    executeStackFrame(stackFrame);

    const i32Array = new Uint32Array(linearMemory.buffer);
    assert.equal(i32Array[3], 1879048192);
  });

  it("should correctly store i64 values", () => {
    const code = [
      t.objectInstruction("const", "i32", [t.numberLiteral(8)]),
      t.objectInstruction("const", "i64", [
        t.numberLiteral("0x0102030405060708", "i64")
      ]),
      t.objectInstruction("store", "i64")
    ];

    const args = [];

    const stackFrame = createStackFrame(
      code,
      args,
      originatingModule,
      allocator
    );

    executeStackFrame(stackFrame);

    const i8Array = new Uint8Array(linearMemory.buffer);
    assert.equal(i8Array[8], 8);
    assert.equal(i8Array[9], 7);
    assert.equal(i8Array[10], 6);
    assert.equal(i8Array[11], 5);
    assert.equal(i8Array[12], 4);
    assert.equal(i8Array[13], 3);
    assert.equal(i8Array[14], 2);
    assert.equal(i8Array[15], 1);
  });

  it("should throw if no linear memory is defined", () => {
    const code = [
      t.objectInstruction("const", "i32", [t.numberLiteral(12)]),
      t.objectInstruction("const", "i32", [t.numberLiteral(0x70000000)]),
      t.objectInstruction("store", "i32")
    ];

    const args = [];

    originatingModule.memaddrs = [];

    const stackFrame = createStackFrame(
      code,
      args,
      originatingModule,
      allocator
    );

    assert.throws(() => executeStackFrame(stackFrame), "unknown memory");
  });

  it("should throw if memory accessed out of bounds", () => {
    const code = [
      t.objectInstruction("const", "i32", [
        t.numberLiteral(PAGE_SIZE * PAGES - I32_SIZE + 1)
      ]),
      t.objectInstruction("const", "i32", [t.numberLiteral(0)]),
      t.objectInstruction("store", "i32")
    ];

    const args = [];

    const stackFrame = createStackFrame(
      code,
      args,
      originatingModule,
      allocator
    );

    assert.throws(
      () => executeStackFrame(stackFrame),
      "memory access out of bounds"
    );
  });

  it("should not throw if memory accessed within bounds - upper boundary value", () => {
    const code = [
      t.objectInstruction("const", "i32", [
        t.numberLiteral(PAGE_SIZE - I32_SIZE) // upper boundary value
      ]),
      t.objectInstruction("const", "i32", [t.numberLiteral(0)]),
      t.objectInstruction("store", "i32")
    ];

    const args = [];

    const stackFrame = createStackFrame(
      code,
      args,
      originatingModule,
      allocator
    );

    executeStackFrame(stackFrame);
  });

  it("should allow an offset to be specified", () => {
    const code = [
      t.objectInstruction("const", "i32", [t.numberLiteral(4)]),
      t.objectInstruction("const", "i32", [t.numberLiteral(25)]),
      t.objectInstruction("store", "i32", [], {
        offset: 0x4
      })
    ];

    const args = [];

    const stackFrame = createStackFrame(
      code,
      args,
      originatingModule,
      allocator
    );

    executeStackFrame(stackFrame);

    const i32Array = new Uint32Array(linearMemory.buffer);
    assert.equal(i32Array[2], 25);
  });

  it("should ensure the offset is within the required bounds", () => {
    const execueteStoreWithOffset = offset => {
      const code = [
        t.objectInstruction("const", "i32", [t.numberLiteral(0)]),
        t.objectInstruction("const", "i32", [t.numberLiteral(25)]),
        t.objectInstruction("store", "i32", [], {
          offset
        })
      ];

      const args = [];

      const stackFrame = createStackFrame(
        code,
        args,
        originatingModule,
        allocator
      );

      executeStackFrame(stackFrame);
    };

    assert.doesNotThrow(() => execueteStoreWithOffset(0));
    assert.throws(() => execueteStoreWithOffset(-1), "offset must be positive");
    assert.throws(
      () => execueteStoreWithOffset(0xffffffff + 1),
      "offset must be less than or equal to 0xffffffff"
    );
  });
});