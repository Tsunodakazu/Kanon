__$__.ASTTransforms = {
    checkPoint_idCounter: 1, // this is used to count id of each check point
    pairCPID: {}, // {int to int}
    stmtTypes: {
        ExpressionStatement: true,
        BlockStatement: true,
        DebuggerStatement: true,
        WithStatement: true,
        ReturnStatement: true,
        LabeledStatement: true,
        BreakStatement: true,
        ContinueStatement: true,
        IfStatement: true,
        SwitchStatement: true,
        TryStatement: true,
        WhileStatement: true,
        DoWhileStatement: true,
        ForStatement: true,
        ForInStatement: true,
        FunctionDeclaration: true,
        VariableDeclaration: true,
        ClassDeclaration: true
    },
    funcTypes: {
        FunctionDeclaration: true,
        FunctionExpression: true,
        ArrowFunctionExpression: true
    },
    loopTypes: {
        WhileStatement: true,
        DoWhileStatement: true,
        ForStatement: true,
        ForInStatement: true
    },
    varScopes: {
        FunctionDeclaration: true,
        FunctionExpression: true,
        ArrowFunctionExpression: true,
        BlockStatement: true,
        ForStatement: true,
        ForInStatement: true
    },
    Loop: {
        DoWhileStatement: 'do-while',
        WhileStatement: 'while',
        ForStatement: 'for',
        ForInStatement: 'for-in',
        FunctionExpression: 'func-exp',
        FunctionDeclaration: 'func-dec',
        ArrowFunctionExpression: 'arrow-func'
    }
};

/**
 * In this visitor a program is converted as the follow example.
 * This visitor is executed when the traversing AST leaved a node whose type is NewExpression, ArrayExpression, or ObjectExpression.
 *
 * before: new Class(arg1, ...)
 *
 * after:  (() => {
 *             __stackForCallTree.push(
 *                 new __$__.CallTree.Instance(
 *                     'unique ID',
 *                     __stackForCallTree,
 *                     'Class'
 *                 )
 *             );
 *             var __newObjectId = __stackForCallTree.last().getContextSensitiveID();
 *
 *             __newObjectIds.push(__newObjectId);
 *             __newExpInfo.push({loopLabel , loopCount, pos}});
 *             var __temp = new Class(arg1, ...);
 *             __newExpInfo.pop();
 *             __stackForCallTree.pop();
 *             if (!__temp.__id) {
 *                 Object.setProperty(__temp, '__id', __newObjectIds.pop());
 *                 __objs.push(__temp);
 *             }
 *             return __temp;
 *         })()
 *
 * Array Expression is also the same
 */
__$__.ASTTransforms.CollectObjects = function() {
    let b = __$__.ASTBuilder;
    return {
        leave(node, path) {
            if (node.loc && ('NewExpression' === node.type || 'ArrayExpression' === node.type || 'ObjectExpression' === node.type)) {
                const c = {};
                if (node.type === 'NewExpression') {
                    c.LabelPos = __$__.Context.LabelPos.New;
                    c.callee = node.callee.name;
                    c.label_header = 'new';
                    c.this_node = b.NewExpression(
                        node.callee,
                        node.arguments
                    );
                    c.newExpInfo = b.ObjectExpression([
                        b.Property(
                            b.Identifier('loopLabel'),
                            b.CallExpression(
                                b.MemberExpression(
                                    b.Identifier('__loopLabels'),
                                    b.Identifier('last')
                                ),
                                []
                            )
                        ),
                        b.Property(
                            b.Identifier('loopCount'),
                            b.Identifier('__loopCount')
                        ),
                        b.Property(
                            b.Identifier('pos'),
                            b.ObjectExpression([
                                b.Property(
                                    b.Identifier('line'),
                                    b.Literal(node.loc.end.line)
                                ),
                                b.Property(
                                    b.Identifier('column'),
                                    b.Literal(node.loc.end.column)
                                )
                            ])
                        )
                    ]);
                } else if (node.type === 'ArrayExpression') {
                    c.LabelPos = __$__.Context.LabelPos.Arr;
                    c.callee = 'Array';
                    c.label_header = 'arr';
                    c.this_node = b.ArrayExpression(
                        node.elements
                    );
                    c.newExpInfo = b.Literal(false);
                } else {
                    c.LabelPos = __$__.Context.LabelPos.Obj;
                    c.callee = 'Object';
                    c.label_header = 'obj';
                    c.this_node = b.ObjectExpression(
                        node.properties
                    );
                    c.newExpInfo = b.Literal(false);
                }


                // In this part, register the position of this NewExpression.
                // If already registered, use the Label
                let label;
                Object.keys(c.LabelPos).forEach(labelName => {
                    let pos = c.LabelPos[labelName];
                    if (pos.start.line === node.loc.start.line &&
                            pos.start.column === node.loc.start.column &&
                            pos.end.line === node.loc.end.line &&
                            pos.end.column === node.loc.end.column) {
                        label = labelName;
                        pos.useLabel = true;
                        pos.closed = true;
                    }
                });
                // the case of not registered yet.
                if (!label) {
                    let i = 1;
                    while (!label) {
                        let newLabel = c.label_header + i;
                        if (!c.LabelPos[newLabel])
                            label = newLabel;
                        i++;
                    }
                    c.LabelPos[label] = node.loc;
                    c.LabelPos[label].useLabel = true;
                    c.LabelPos[label].closed = true;
                }

                return b.CallExpression(
                    b.ArrowFunctionExpression(
                        [],
                        b.BlockStatement([
                            //  __stackForCallTree.push(
                            //     new __$__.CallTree.Instance(
                            //         'unique ID',
                            //         __stackForCallTree,
                            //         'Class'
                            //     )
                            // );
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__stackForCallTree'),
                                        b.Identifier('push')
                                    ),
                                    [b.NewExpression(
                                        b.MemberExpression(
                                            b.MemberExpression(
                                                b.Identifier('__$__'),
                                                b.Identifier('CallTree')
                                            ),
                                            b.Identifier('Instance')
                                        ),
                                        [
                                            b.Literal(label),
                                            b.Identifier('__stackForCallTree'),
                                            b.Literal(c.callee)
                                        ]
                                    )]
                                )
                            ),
                            // var __newObjectId = __stackForCallTree.last().getContextSensitiveID();
                            b.VariableDeclaration([
                                b.VariableDeclarator(
                                    b.Identifier('__newObjectId'),
                                    b.CallExpression(
                                        b.MemberExpression(
                                            b.CallExpression(
                                                b.MemberExpression(
                                                    b.Identifier('__stackForCallTree'),
                                                    b.Identifier('last')
                                                ),
                                                []
                                            ),
                                            b.Identifier('getContextSensitiveID')
                                        ),
                                        []
                                    )
                                )
                            ], 'var'),
                            // __newObjectIds.push(__newObjectId);
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__newObjectIds'),
                                        b.Identifier('push')
                                    ), [
                                        b.Identifier('__newObjectId')
                                    ]
                                )
                            ),
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__newExpInfo'),
                                        b.Identifier('push')
                                    ), [
                                        c.newExpInfo
                                    ]
                                )
                            ),
                            b.VariableDeclaration([
                                b.VariableDeclarator(
                                    b.Identifier('__temp'),
                                    c.this_node
                                )
                            ], 'var'),
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__newExpInfo'),
                                        b.Identifier('pop')
                                    ), []
                                )
                            ),
                            // __stackForCallTree.pop();
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__stackForCallTree'),
                                        b.Identifier('pop')
                                    ), []
                                )
                            ),
                            /**
                             * if (!__temp.__id) {
                             *     Object.setProperty(__temp, '__id', __newObjectIds.pop());
                             *     __objs.push(__temp);
                             * }
                             */
                            b.IfStatement(
                                b.UnaryExpression(
                                    '!',
                                    b.MemberExpression(
                                        b.Identifier('__temp'),
                                        b.Identifier('__id')
                                    )
                                ),
                                b.BlockStatement([
                                    b.ExpressionStatement(
                                        // Object.setProperty(__temp, "__id", __newObjectIds.pop())
                                        b.CallExpression(
                                            b.MemberExpression(
                                                b.Identifier('Object'),
                                                b.Identifier('setProperty')
                                            ), [
                                                b.Identifier('__temp'),
                                                b.Literal('__id'),
                                                b.CallExpression(
                                                    b.MemberExpression(
                                                        b.Identifier('__newObjectIds'),
                                                        b.Identifier('pop')
                                                    ),
                                                    []
                                                )
                                            ]
                                        )

                                    ),
                                    b.ExpressionStatement(
                                        // __objs.push(__temp)
                                        b.CallExpression(
                                            b.MemberExpression(
                                                b.Identifier('__objs'),
                                                b.Identifier('push')
                                            ),
                                            [b.Identifier('__temp')]
                                        )
                                    )
                                ])
                            ),
                            b.ReturnStatement(
                                b.Identifier("__temp")
                            )
                        ])
                    ),
                    []
                );
            }
        }
    };
};


/**
 * To give a unique Label to CallExpressions,
 * we convert CallExpression to the following example program.
 *
 * before:
 * func(arg1, arg2, ...)
 *
 * after:
 * (() => {
 *     if (__call_count['unique Label']) __call_count['unique Label']++;
 *     else __call_count['unique Label'] = 1;
 *
 *     __stackForCallTree.push(
 *         new __$__.CallTree.FunctionCall(
 *             'unique Label',
 *             __stackForCallTree,
 *             __call_count['unique Label']
 *         )
 *     );
 *     __newExpInfo.push(false);
 *     var __temp = func(arg1, arg2, ...);
 *     __newExpInfo.pop();
 *     __stackForCallTree.pop();
 *     return __temp;
 * })()
 */
__$__.ASTTransforms.CallExpressionToFunction = function() {
    let b = __$__.ASTBuilder;
    return {
        leave(node, path) {
            if (node.type === "CallExpression" && node.loc) {
                const counterName = "__call_count";

                // In this part, register the position of this CallExpression.
                // If already registered, use the Label
                let label;
                Object.keys(__$__.Context.LabelPos.Call).forEach(callLabel => {
                    let pos = __$__.Context.LabelPos.Call[callLabel];
                    if (pos.start.line === node.loc.start.line &&
                            pos.start.column === node.loc.start.column &&
                            pos.end.line === node.loc.end.line &&
                            pos.end.column === node.loc.end.column) {
                        label = callLabel;
                        pos.useLabel = true;
                        pos.closed = true;
                    }
                });
                // the case of not registered yet.
                if (!label) {
                    let i = 1;
                    while (!label) {
                        let callLabel = 'call' + i;
                        if (!__$__.Context.LabelPos.Call[callLabel]) label = callLabel;
                        i++;
                    }
                    __$__.Context.LabelPos.Call[label] = node.loc;
                    __$__.Context.LabelPos.Call[label].useLabel = true;
                    __$__.Context.LabelPos.Call[label].closed = true;
                }

                return b.CallExpression(
                    b.ArrowFunctionExpression(
                        [],
                        b.BlockStatement([
                            b.IfStatement(
                                b.MemberExpression(
                                    b.Identifier(counterName),
                                    b.Literal(label),
                                    true
                                ),
                                b.ExpressionStatement(
                                    b.UpdateExpression(
                                        b.MemberExpression(
                                            b.Identifier(counterName),
                                            b.Literal(label),
                                            true
                                        ),
                                        "++",
                                        false
                                    )
                                ),
                                b.ExpressionStatement(
                                    b.AssignmentExpression(
                                        b.MemberExpression(
                                            b.Identifier(counterName),
                                            b.Literal(label),
                                            true
                                        ),
                                        "=",
                                        b.Literal(1)
                                    )
                                )
                            ),
                            /**
                             * __stackForCallTree.push(
                             *     new __$__.CallTree.FunctionCall(
                             *         'unique Label',
                             *         __stackForCallTree,
                             *         __call_count['unique Label']
                             *     )
                             * );
                             */
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__stackForCallTree'),
                                        b.Identifier('push')
                                    ),
                                    [b.NewExpression(
                                        b.MemberExpression(
                                            b.MemberExpression(
                                                b.Identifier('__$__'),
                                                b.Identifier('CallTree')
                                            ),
                                            b.Identifier('FunctionCall')
                                        ),
                                        [
                                            b.Literal(label),
                                            b.Identifier('__stackForCallTree'),
                                            b.MemberExpression(
                                                b.Identifier('__call_count'),
                                                b.Literal(label),
                                                true
                                            )
                                        ]
                                    )]
                                )
                            ),
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__newExpInfo'),
                                        b.Identifier("push")
                                    ),
                                    [b.Literal(false)]
                                )
                            ),
                            b.VariableDeclaration([
                                b.VariableDeclarator(
                                    b.Identifier('__temp'),
                                    b.CallExpression(
                                        node.callee,
                                        node.arguments
                                    )
                                )],
                                'var'
                            ),
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__newExpInfo'),
                                        b.Identifier("pop")
                                    ), []
                                )
                            ),
                            // __stackForCallTree.pop();
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__stackForCallTree'),
                                        b.Identifier("pop")
                                    ), []
                                )
                            ),
                            b.ReturnStatement(
                                b.Identifier('__temp')
                            )
                        ])
                    ),
                    []
                );
            }
        }
    };
};

/**
 * Add some code in the head of user code.
 *
 * let __loopLabels = ['noLoop'],
 *     __loopCount = 1,
 *     __time_counter = 0,
 *     __time_counter_stack = [],
 *     __call_count = {},
 *     __newObjectIds = [],
 *     __newExpInfo = [],
 *     __stackForCallTree = [__$__.CallTree.rootNode];
 * __objs = [];
 * __$__.Context.StartEndInLoop['noLoop'] = [{start: 0}];
 *
 * ...
 *
 */
__$__.ASTTransforms.AddSomeCodeInHead = function() {
    let b = __$__.ASTBuilder;
    return {
        leave(node, path) {
            if (node.type === 'Program') {
                // __$__.Context.StartEndInLoop['noLoop'] = [{start: 0}];
                node.body.unshift(
                    b.ExpressionStatement(
                        b.Identifier('__$__.Context.StartEndInLoop["noLoop"] = [{start: 0}]')
                    )
                );

                node.body.unshift(
                    b.ExpressionStatement(
                        b.AssignmentExpression(
                            b.Identifier('__objs'),
                            '=',
                            b.ArrayExpression([])
                        )
                    )
                );

                // this is VariableDeclaration at the head of user code
                node.body.unshift(
                    b.VariableDeclaration([
                        b.VariableDeclarator(
                            b.Identifier('__loopLabels'),
                            b.ArrayExpression([b.Literal('noLoop')])
                        ),
                        b.VariableDeclarator(
                            b.Identifier('__loopCount'),
                            b.Literal(1)
                        ),
                        b.VariableDeclarator(
                            b.Identifier('__time_counter'),
                            b.Literal(0)
                        ),
                        b.VariableDeclarator(
                            b.Identifier('__time_counter_stack'),
                            b.ArrayExpression([])
                        ),
                        b.VariableDeclarator(
                            b.Identifier('__call_count'),
                            b.ObjectExpression([])
                        ),
                        b.VariableDeclarator(
                            b.Identifier('__newObjectIds'),
                            b.ArrayExpression([])
                        ),
                        b.VariableDeclarator(
                            b.Identifier('__newExpInfo'),
                            b.ArrayExpression([])
                        ),
                        b.VariableDeclarator(
                            b.Identifier('__stackForCallTree'),
                            b.ArrayExpression([
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.Identifier('__$__'),
                                        b.Identifier('CallTree')
                                    ),
                                    b.Identifier('rootNode')
                                )
                            ])
                        )
                    ], 'let')
                );
            }
        }
    };
};


/**
 * try {
 *     body; (program)
 * } finally {
 *     __$__.Context.StartEndInLoop['noLoop'][0].end = __time_counter - 1;
 * }
 */
__$__.ASTTransforms.BlockedProgram = function() {
    let b = __$__.ASTBuilder;
    return {
        leave(node, path) {
            if (node.type === 'Program') {
                node.body = [
                    b.TryStatement(
                        b.BlockStatement(node.body),
                        undefined,
                        b.BlockStatement([
                            b.ExpressionStatement(
                                b.Identifier("__$__.Context.StartEndInLoop['noLoop'][0].end = __time_counter - 1")
                            )
                        ])
                    )
                ];
            }
        }
    };
};



/** Insert the code to manage the context in loop.
 * loop includes
 * - DoWhileStatement
 * - WhileStatement
 * - ForStatement
 * - ForInStatement
 * - FunctionExpression
 * - FunctionDeclaration
 * - ArrowFunctionExpression
 *
 * This is code conversion example in FunctionExpression
 *
 * before:
 *   function(args) {
 *       ...
 *   }
 *
 * after:
 *   function(args) {
 *       let __loopLabel = 'loop' + label;
 *       __loopLabels.push(__loopLabel);
 *       if (__$__.Context.LoopContext[__loopLabel] === undefined)
 *           __$__.Context.LoopContext[__loopLabel] = 1;
 *       if (!__$__.Context.SensitiveContextForLoop[__loopLabel])
 *           __$__.Context.SensitiveContextForLoop[__loopLabel] = {};
 *       // TODO
 *       if (__$__.Context.ContextSensitiveIDsEachLoop[__loopLabel] === undefined)
 *           __$__.Context.ContextSensitiveIDsEachLoop[__loopLabel] = [];
 *       let __loopCount = ++__$__.Context.__loopCounter[__loopLabel] || (__$__.Context.__loopCounter[__loopLabel] = 1);
 *       if (__loopCount > 100) {
 *           __$__.Context.InfLoop = __loopLabel;
 *           throw 'Infinite Loop';
 *       }
 *       let __start = __time_counter,
 *           __startEndObject__ = {start: __time_counter};
 *       __time_counter_stack.push(__startEndObject__);
 *       __stackForCallTree.push(
 *           new __$__.CallTree.Function(
 *               __loopLabel,
 *               __stackForCallTree,
 *               [simplifiedLabel],
 *               [function name]
 *           )
 *       );
 *
 *       __$__.Context.SensitiveContextForLoop[__loopLabel][__loopCount] = __stackForCallTree.last().getContextSensitiveID();
 *       if (!__$__.Context.StartEndInLoop[__loopLabel]) __$__.Context.StartEndInLoop[__loopLabel] = [];
 *       __$__.Context.StartEndInLoop[__loopLabel].push(__startEndObject__);
 *       // TODO
 *       __$__.Context.ContextSensitiveIDsEachLoop[__loopLabel].push(__stackForCallTree.last().getContextSensitiveID());
 *
 *       // if this function is called as a constructor, assign a unique object ID to this.
 *       if (__newExpInfo.last()) {
 *           Object.setProperty(this, '__id', __newObjectIds.pop());
 *           __objs.push(this);
 *       }
 *       __$__.Context.ParentAndChildOnCallTree[__loopLabels[__loopLabels.length-2]].children[__loopLabel] = true;
 *       __$__.Context.ParentAndChildOnCallTree[__loopLabel] = __$__.Context.ParentAndChildOnCallTree[__loopLabel] || {parent: {}, children: {}};
 *       __$__.Context.ParentAndChildOnCallTree[__loopLabel].parent[__loopLabels[__loopLabels.length-2]] = true;
 *
 *       try {
 *           ... (body)
 *       } finally {
 *           __startEndObject__.end = __time_counter - 1;
 *           __time_counter_stack.pop();
 *           __stackForCallTree.pop();
 *           __loopLabels.pop();
 *       }
 *   }
 *
 * __loopLabel is unique label
 *
 * This is code conversion example in WhileStatement
 * before:
 *   while(condition) {
 *       ...
 *   }
 *
 *
 * after:
 *     {
 *         let __loopLabel = 'loop' + label,
 *             __loopCounter = 0;
 *         __loopLabels.push(__loopLabel);
 *         if (__$__.Context.LoopContext[__loopLabel] === undefined)
 *             __$__.Context.LoopContext[__loopLabel] = 1;
 *         if (!__$__.Context.SensitiveContextForLoop[__loopLabel])
 *             __$__.Context.SensitiveContextForLoop[__loopLabel] = {};
 *         // TODO
 *         if (__$__.Context.ContextSensitiveIDsEachLoop[__loopLabel] === undefined)
 *             __$__.Context.ContextSensitiveIDsEachLoop[__loopLabel] = [];
 *         __$__.Context.ParentAndChildOnCallTree[__loopLabels[__loopLabels.length-2]].children[__loopLabel] = true;
 *         __$__.Context.ParentAndChildOnCallTree[__loopLabel] = __$__.Context.ParentAndChildOnCallTree[__loopLabel] || {parent: {}, children: {}};
 *         __$__.Context.ParentAndChildOnCallTree[__loopLabel].parent[__loopLabels[__loopLabels.length-2]] = true;
 *
 *         try {
 *             while (condition) {
 *                 __loopCounter++;
 *                 let __loopCount = ++__loopCounter[__loopLabel] || (__loopCounter[__loopLabel] = 1);
 *                 if (__loopCount > 100){
 *                     __$__.Context.InfLoop = __loopLabel;
 *                     throw 'Infinite Loop';
 *                 }
 *                 let __start = __time_counter,
 *                     __startEndObject__ = {start: __time_counter};
 *                 __time_counter_stack.push(__startEndObject__);
 *                 __stackForCallTree.push(
 *                     new __$__.CallTree.Loop(
 *                         __loopLabel,
 *                         __stackForCallTree,
                 *         [simplifiedLabel],
 *                         __loopCounter
 *                     )
 *                 );
 *
 *                 __$__.Context.SensitiveContextForLoop[__loopLabel][__loopCount] = __stackForCallTree.last().getContextSensitiveID();
 *
 *                 if (!__$__.Context.StartEndInLoop[__loopLabel])
 *                     __$__.Context.StartEndInLoop[__loopLabel] = [];
 *                 __$__.Context.StartEndInLoop[__loopLabel].push(__startEndObject__);
 *
 *                 // TODO
 *                 __$__.Context.ContextSensitiveIDsEachLoop[__loopLabel].push(__stackForCallTree.last().getContextSensitiveID());
 *
 *                 // there is following IfStatement in the case only of functions
 *                 if (__newExpInfo.last()) {
 *                     Object.setProperty(this, '__id', __newObjectIds.pop());
 *                     __objs.push(this);
 *                 }
 *
 *                 try {
 *                     ... (body of the loop)
 *                 } finally {
 *                     __startEndObject__.end = __time_counter-1;
 *                     __time_counter_stack.pop();
 *                     __stackForCallTree.pop();
 *                 }
 *             }
 *         } finally {
 *             __loopLabels.pop();
 *         }
 *     }
 */
__$__.ASTTransforms.Context = function (checkInfLoop) {
    let b = __$__.ASTBuilder;
    let id = 'context';
    const loopLabels = "__loopLabels",
          loopCount = "__loopCount",
          loopCounter = "__$__.Context.__loopCounter",
          loopContext = "LoopContext";
    let labelCount = 0;
    return {
        enter(node, path) {
            if (__$__.ASTTransforms.Loop[node.type] && node.loc) {


                // If already registered, use the label
                let label;
                Object.keys(__$__.Context.LabelPos.Loop).forEach(loopLabel => {
                    let pos = __$__.Context.LabelPos.Loop[loopLabel];
                    if (pos.start.line === node.loc.start.line &&
                            pos.start.column === node.loc.start.column &&
                            pos.end.line === node.loc.end.line &&
                            pos.end.column === node.loc.end.column) {
                        label = loopLabel;
                        pos.useLabel = true;
                        if (checkInfLoop)
                            pos.closed = node.body.type === 'BlockStatement';
                    }
                });
                // the case that the Label have not been registered yet.
                if (!label) {
                    let i = 1;
                    let loopLabel;
                    while (!label) {
                        loopLabel = node.type + i;
                        if (!__$__.Context.LabelPos.Loop[loopLabel])
                            break;
                        i++;
                    }
                    label = loopLabel;
                    if (path[path.length - 2].type === 'LabeledStatement')
                        label += '-' + path[path.length - 2].label.name;
                    __$__.Context.LabelPos.Loop[label] = node.loc;
                    __$__.Context.LabelPos.Loop[label].useLabel = true;
                    if (checkInfLoop)
                        __$__.Context.LabelPos.Loop[label].closed = node.body.type === 'BlockStatement';
                }

                if (node.body.type !== "BlockStatement") {
                    if (node.type === 'ArrowFunctionExpression') {
                        let retStmt = b.ReturnStatement(node.body);
                        retStmt.loc = node.body.loc;
                        node.body = b.BlockStatement([retStmt]);
                        node.expression = false;
                    } else
                        node.body = b.BlockStatement([node.body]);
                }

                __$__.Context.ParentAndChildrenLoop[label] = {parent: __$__.Context.ParentAndChildrenLoopStack.last(), children: []};
                __$__.Context.ParentAndChildrenLoop[__$__.Context.ParentAndChildrenLoopStack.last()].children.push(label);
                __$__.Context.ParentAndChildrenLoopStack.push(label);

                return [id, {label: label, checkInfLoop: checkInfLoop}];
            }
        },
        leave(node, path, enterData) {
            if (__$__.ASTTransforms.Loop[node.type] && node.loc) {
                let parent = path[path.length - 2];
                let data = enterData[id],
                    label = data.label,
                    checkInfLoop = data.checkInfLoop,
                    isFunction = __$__.ASTTransforms.funcTypes[node.type];

                __$__.Context.ParentAndChildrenLoopStack.pop();

                // if (node.type is 'functiondeclaration' or 'functionexpression'or ...,
                // then, node.params is the parameters of the function


                let finallyBody = [
                    b.ExpressionStatement(
                        b.Identifier('__startEndObject__.end = __time_counter-1')
                    ),
                    b.ExpressionStatement(
                        b.Identifier('__time_counter_stack.pop()')
                    ),
                    b.ExpressionStatement(
                        b.CallExpression(
                            b.MemberExpression(
                                b.Identifier('__stackForCallTree'),
                                b.Identifier('pop')
                            ),
                            []
                        )
                    )
                ];

                let newBlockStmt = b.BlockStatement([]);
                if (isFunction) {
                    finallyBody.push(
						b.ExpressionStatement(
							b.Identifier('__loopLabels.pop()')
						)
					);

                    newBlockStmt.body.push(
                        b.VariableDeclaration([
                            b.VariableDeclarator(
                                b.Identifier('__loopLabel'),
                                b.Literal(label)
                            )
                        ], 'let')
                    );

                    newBlockStmt.body.push(
                        b.ExpressionStatement(
                            b.CallExpression(
                                b.MemberExpression(
                                    b.Identifier('__loopLabels'),
                                    b.Identifier('push')
                                ),
                                [b.Identifier('__loopLabel')]
                            )
                        )
                    );

                    // if (__$__.Context.LoopContext[__loopLabel] === undefined) __$__.Context.LoopContext[__loopLabel] = 1;
                    newBlockStmt.body.push(
                        b.IfStatement(
                            b.BinaryExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context')
                                        ),
                                        b.Identifier('LoopContext')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                '===',
                                b.Identifier('undefined')
                            ),
                            b.ExpressionStatement(
                                b.AssignmentExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.MemberExpression(
                                                b.Identifier('__$__'),
                                                b.Identifier('Context')
                                            ),
                                            b.Identifier('LoopContext')
                                        ),
                                        b.Identifier('__loopLabel'),
                                        true
                                    ),
                                    '=',
                                    b.Literal(1)
                                )
                            )
                        )
                    );

                    newBlockStmt.body.push(
                        b.IfStatement(
                            b.UnaryExpression(
                                '!',
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context')
                                        ),
                                        b.Identifier('SensitiveContextForLoop')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                true
                            ),
                            b.ExpressionStatement(
                                b.AssignmentExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.MemberExpression(
                                                b.Identifier('__$__'),
                                                b.Identifier('Context')
                                            ),
                                            b.Identifier('SensitiveContextForLoop')
                                        ),
                                        b.Identifier('__loopLabel'),
                                        true
                                    ),
                                    '=',
                                    b.ObjectExpression([])
                                )
                            )
                        )
                    );

                    /**
                     * if (__$__.Context.ContextSensitiveIDsEachLoop[__loopLabel] === undefined)
                     *     __$__.Context.ContextSensitiveIDsEachLoop[__loopLabel] = [];
                     */
                    newBlockStmt.body.push(
                        b.IfStatement(
                            b.BinaryExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context'),
                                        ),
                                        b.Identifier('ContextSensitiveIDsEachLoop')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                '===',
                                b.Identifier('undefined')
                            ),
                            b.ExpressionStatement(
                                b.AssignmentExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.MemberExpression(
                                                b.Identifier('__$__'),
                                                b.Identifier('Context'),
                                            ),
                                            b.Identifier('ContextSensitiveIDsEachLoop')
                                        ),
                                        b.Identifier('__loopLabel'),
                                        true
                                    ),
                                    '=',
                                    b.ArrayExpression([])
                                )
                            )
                        )
                    )

                } else {
                    newBlockStmt.body.push(
                        b.ExpressionStatement(
                            b.UnaryExpression(
                                '++',
                                b.Identifier('__loopCounter'),
                                false
                            )
                        )
                    );
                }

                newBlockStmt.body.push(
                    b.VariableDeclaration([
                        b.VariableDeclarator(
                            b.Identifier(loopCount),
                            b.BinaryExpression(
                                b.UnaryExpression(
                                    '++',
                                    b.MemberExpression(
                                        b.Identifier(loopCounter),
                                        b.Identifier('__loopLabel'),
                                        true
                                    ),
                                    true
                                ),
                                '||',
                                b.AssignmentExpression(
                                    b.MemberExpression(
                                        b.Identifier(loopCounter),
                                        b.Identifier('__loopLabel'),
                                        true
                                    ),
                                    '=',
                                    b.Literal(1)
                                )
                            )
                        )
                    ], 'let')
                );

                newBlockStmt.body.push(
                    b.IfStatement(
                        b.BinaryExpression(
                            b.Identifier(loopCount),
                            ">",
                            b.Literal(100)
                        ),
                        b.BlockStatement([
                            b.ExpressionStatement(
                                b.AssignmentExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context')
                                        ),
                                        b.Identifier('InfLoop')
                                    ),
                                    '=',
                                    b.Identifier('__loopLabel')
                                )
                            ),
                            b.ThrowStatement(
                                b.Literal('Infinite Loop')
                            )
                        ])
                    )
                );

                newBlockStmt.body.push(
                    b.VariableDeclaration([
                        b.VariableDeclarator(
                            b.Identifier('__start'),
                            b.Identifier('__time_counter')
                        ),
                        b.VariableDeclarator(
                            b.Identifier('__startEndObject__'),
                            b.ObjectExpression([
                                b.Property(
                                    b.Identifier('start'),
                                    b.Identifier('__time_counter')
                                )
                            ])
                        )
                    ], 'let')
                );

                newBlockStmt.body.push(
                    b.ExpressionStatement(
                        b.CallExpression(
                            b.MemberExpression(
                                b.Identifier('__time_counter_stack'),
                                b.Identifier('push')
                            ),
                            b.Identifier('__startEndObject')
                        )
                    )
                );

                /**
                 * __stackForCallTree.push(
                 *     new __$__.CallTree.Function(
                 *         __loopLabel,
                 *         __stackForCallTree,
                 *         [simplifiedLabel],
                 *         [function name]
                 *     )
                 * );
                 * or
                 * __stackForCallTree.push(
                 *     new __$__.CallTree.Loop(
                 *         __loopLabel,
                 *         __stackForCallTree,
                 *         [simplifiedLabel],
                 *         __loopCounter
                 *     )
                 * );
                 */
                let arg3;
                if (isFunction) {
                    if (node.id && node.id.name) {
                        arg3 = b.Literal(node.id.name);
                    } else if (parent.type === 'MethodDefinition' && parent.key && parent.key.name) {
                        arg3 = b.Literal(parent.key.name);
                    } else {
                        arg3 = b.Literal(null);
                    }
                } else {
                    arg3 = b.Identifier('__loopCounter');
                }
                newBlockStmt.body.push(
                    b.ExpressionStatement(
                        b.CallExpression(
                            b.MemberExpression(
                                b.Identifier('__stackForCallTree'),
                                b.Identifier('push')
                            ),
                            [b.NewExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.Identifier('__$__'),
                                        b.Identifier('CallTree')
                                    ),
                                    b.Identifier((isFunction) ? 'Function' : 'Loop')
                                ),
                                [
                                    b.Identifier('__loopLabel'),
                                    b.Identifier('__stackForCallTree'),
                                    b.Literal(label.replace(node.type, __$__.ASTTransforms.Loop[node.type])),
                                    arg3
                                ]
                            )]
                        )
                    )
                );

                /**
                 * __$__.Context.SensitiveContextForLoop[__loopLabel][__loopCount] = __stackForCallTree.last().getContextSensitiveID();
                 */
                newBlockStmt.body.push(
                    b.ExpressionStatement(
                        b.AssignmentExpression(
                            b.MemberExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context')
                                        ),
                                        b.Identifier('SensitiveContextForLoop')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                b.Identifier('__loopCount'),
                                true
                            ),
                            '=',
                            b.CallExpression(
                                b.MemberExpression(
                                    b.CallExpression(
                                        b.MemberExpression(
                                            b.Identifier('__stackForCallTree'),
                                            b.Identifier('last')
                                        ),
                                        []
                                    ),
                                    b.Identifier('getContextSensitiveID')
                                ),
                                []
                            )
                        )
                    )
                );

                newBlockStmt.body.push(
                    b.IfStatement(
                        b.UnaryExpression(
                            '!',
                            b.MemberExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.Identifier('__$__'),
                                        b.Identifier('Context')
                                    ),
                                    b.Identifier('StartEndInLoop')
                                ),
                                b.Identifier('__loopLabel'),
                                true
                            ),
                            true
                        ),
                        b.ExpressionStatement(
                            b.AssignmentExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context')
                                        ),
                                        b.Identifier('StartEndInLoop')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                '=',
                                b.ArrayExpression([])
                            )
                        )
                    )
                );

                newBlockStmt.body.push(
                    b.ExpressionStatement(
                        b.CallExpression(
                            b.MemberExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context')
                                        ),
                                        b.Identifier('StartEndInLoop')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                b.Identifier('push')
                            ),
                            [b.Identifier('__startEndObject__')]
                        )
                    )
                );

                /**
                 * __$__.Context.ContextSensitiveIDsEachLoop[__loopLabel].push(__stackForCallTree.last().getContextSensitiveID());
                 */
                newBlockStmt.body.push(
                    b.ExpressionStatement(
                        b.CallExpression(
                            b.MemberExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context')
                                        ),
                                        b.Identifier('ContextSensitiveIDsEachLoop')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                b.Identifier('push')
                            ),
                            [b.CallExpression(
                                b.MemberExpression(
                                    b.CallExpression(
                                        b.MemberExpression(
                                            b.Identifier('__stackForCallTree'),
                                            b.Identifier('last')
                                        ),
                                        []
                                    ),
                                    b.Identifier('getContextSensitiveID')
                                ),
                                []
                            )]
                        )
                    )
                );

                newBlockStmt.body.push(
                    b.IfStatement(
                        b.CallExpression(
                            b.MemberExpression(
                                b.Identifier('__newExpInfo'),
                                b.Identifier('last')
                            ), []
                        ),
                        b.BlockStatement([
                            b.ExpressionStatement(
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('Object'),
                                        b.Identifier('setProperty')
                                    ), [
                                        b.Identifier('this'),
                                        b.Literal('__id'),
                                        b.CallExpression(
                                            b.MemberExpression(
                                                b.Identifier('__newObjectIds'),
                                                b.Identifier('pop')
                                            ),
                                            []
                                        )
                                    ]
                                )
                            ),
                            b.ExpressionStatement(
                                // b.Identifier('__objs.push(this)')
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__objs'),
                                        b.Identifier('push')
                                    ),
                                    [b.Identifier('this')]
                                )
                            )
                        ])
                    )
                );


                if (isFunction) {
                    // __$__.Context.ParentAndChildOnCallTree[__loopLabels[__loopLabels.length-2]].children[__loopLabel] = true;
                    // __$__.Context.ParentAndChildOnCallTree[__loopLabel] = __$__.Context.ParentAndChildOnCallTree[__loopLabel] || {parent: {}, children: {}};
                    // __$__.Context.ParentAndChildOnCallTree[__loopLabel].parent[__loopLabels[__loopLabels.length-2]] = true;
                    newBlockStmt.body.push(
                        b.ExpressionStatement(
                            b.Identifier('__$__.Context.ParentAndChildOnCallTree[__loopLabels[__loopLabels.length-2]].children[__loopLabel] = true')
                        )
                    );
                    newBlockStmt.body.push(
                        b.ExpressionStatement(
                            b.Identifier('__$__.Context.ParentAndChildOnCallTree[__loopLabel] = __$__.Context.ParentAndChildOnCallTree[__loopLabel] || {parent: {}, children: {}}')
                        )
                    );
                    newBlockStmt.body.push(
                        b.ExpressionStatement(
                            b.Identifier('__$__.Context.ParentAndChildOnCallTree[__loopLabel].parent[__loopLabels[__loopLabels.length-2]] = true;')
                        )
                    );
                }

                newBlockStmt.body.push(
                    b.TryStatement(
                        Object.assign({}, node.body),
                        undefined,
                        b.BlockStatement(finallyBody)
                    )
                );


                node.body = newBlockStmt;

                if (!isFunction) {

                    let stmt;

                    if (parent.type === 'LabeledStatement') {
                        let label = parent.label;
                        parent.label = b.Identifier('______' + ++labelCount);
                        stmt = b.LabeledStatement(label, Object.assign({}, node));
                    } else {
                        stmt = Object.assign({}, node);
                    }

                    return b.BlockStatement([
                        b.VariableDeclaration([
                            b.VariableDeclarator(
                                b.Identifier('__loopLabel'),
                                b.Literal(label)
                            ),
                            b.VariableDeclarator(
                                b.Identifier('__loopCounter'),
                                b.Literal(0)
                            ),
                        ], 'let'),
                        b.ExpressionStatement(
                            b.Identifier('__loopLabels.push(__loopLabel)')
                        ),
                        b.ExpressionStatement(
                            b.Identifier('if (__$__.Context.LoopContext[__loopLabel] === undefined) __$__.Context.LoopContext[__loopLabel] = 1')
                        ),
                        b.IfStatement(
                            b.UnaryExpression(
                                '!',
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context')
                                        ),
                                        b.Identifier('SensitiveContextForLoop')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                true
                            ),
                            b.ExpressionStatement(
                                b.AssignmentExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.MemberExpression(
                                                b.Identifier('__$__'),
                                                b.Identifier('Context')
                                            ),
                                            b.Identifier('SensitiveContextForLoop')
                                        ),
                                        b.Identifier('__loopLabel'),
                                        true
                                    ),
                                    '=',
                                    b.ObjectExpression([])
                                )
                            )
                        ),
                        /**
                         * if (__$__.Context.ContextSensitiveIDsEachLoop[__loopLabel] === undefined)
                         *     __$__.Context.ContextSensitiveIDsEachLoop[__loopLabel] = [];
                         */
                        b.IfStatement(
                            b.BinaryExpression(
                                b.MemberExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.Identifier('__$__'),
                                            b.Identifier('Context'),
                                        ),
                                        b.Identifier('ContextSensitiveIDsEachLoop')
                                    ),
                                    b.Identifier('__loopLabel'),
                                    true
                                ),
                                '===',
                                b.Identifier('undefined')
                            ),
                            b.ExpressionStatement(
                                b.AssignmentExpression(
                                    b.MemberExpression(
                                        b.MemberExpression(
                                            b.MemberExpression(
                                                b.Identifier('__$__'),
                                                b.Identifier('Context'),
                                            ),
                                            b.Identifier('ContextSensitiveIDsEachLoop')
                                        ),
                                        b.Identifier('__loopLabel'),
                                        true
                                    ),
                                    '=',
                                    b.ArrayExpression([])
                                )
                            )
                        ),
                        b.ExpressionStatement(
                            b.Identifier('__$__.Context.ParentAndChildOnCallTree[__loopLabels[__loopLabels.length-2]].children[__loopLabel] = true')
                        ),
                        b.ExpressionStatement(
                            b.Identifier('__$__.Context.ParentAndChildOnCallTree[__loopLabel] = __$__.Context.ParentAndChildOnCallTree[__loopLabel] || {parent: {}, children: {}}')
                        ),
                        b.ExpressionStatement(
                            b.Identifier('__$__.Context.ParentAndChildOnCallTree[__loopLabel].parent[__loopLabels[__loopLabels.length-2]] = true;')
                        ),
                        b.TryStatement(
                            b.BlockStatement([stmt]),
                            undefined,
                            b.BlockStatement([
                                b.ExpressionStatement(
                                    b.Identifier('__loopLabels.pop()')
                                )
                            ])
                        )
                    ]);
                }
            }
        }
    };
};


/**
 * insert check point before and after each statement (VariableDeclaration is exception).
 *
 * if statement type is 'return', 'break', 'continue', 
 *   Statement -> {checkPoint; Statement} ... (1)
 *
 * otherwise
 *   Statement -> {checkPoint; Statement; checkPoint} ... (2)
 *
 *
 * But, if use (2) when Statement type is VariableDeclaration and node.kind is not 'var',
 * the scope of variables is changed. Additionally, if use (2) when node.parent.type is
 * 'ForStatement' or 'ForInStatement', transformed code cause run time error. For example,
 * 'var i = 0' in 'for (var i = 0; i < 10; i++) {...}' mustn't be transformed. So,
 *
 *
 * if Statement type is VariableDeclaration and node.kind is 'let' or 'const',
 *   Statement -> [checkPoint; Statement; checkPoint] ... (3)
 *
 * if Statement type is VariableDeclaration and node.kind is 'var',
 *   Statement -> {checkPoint; Statement; checkPoint} ... (2)
 *
 *
 * At the same time, implement variable visualization by using '$'.
 * the scope of variables is implemented by my environment whose style is stack.
 *
 * inserted check point is
 * '__$__.Context.CheckPoint(__objs, __loopLabel, __loopCount, __time_counter, {})'
 * and, the last of arguments is object which means visualization of variables.
 * the argument is {v: typeof v === 'string' ? eval(v) : undefined} if variable 'v' should be visualized.
 *
 */
__$__.ASTTransforms.InsertCheckPoint = function() {
    let b = __$__.ASTBuilder;
    let id = 'InsertCheckPoint';
    __$__.ASTTransforms.checkPoint_idCounter = 1;
    let env = new __$__.Probe.StackEnv();

    return {
        enter(node, path) {
            if (__$__.ASTTransforms.funcTypes[node.type]) {
                env.push(new __$__.Probe.FunctionFlame());

                if (!node.expression) {
                    node.body.body.forEach(s => {
                        if (s.type === 'VariableDeclaration' && s.kind === 'var') {
                            s.declarations.forEach(declarator => {
                                env.addVariable(declarator.id.name.slice(1, declarator.id.name.length), s.kind, false);
                            });
                        }
                    });
                }

				node.params.forEach(param => {
					if(param instanceof Object)  env.addVariable(param.name, "var", true)
				});
            }


            if (node.type === 'BlockStatement') {
                env.push(new __$__.Probe.BlockFlame());

                node.body.forEach(s => {
                    if (s.type === 'VariableDeclaration' && s.kind !== 'var') {
                        s.declarations.forEach(declarator => {
                            env.addVariable(declarator.id.name, s.kind, false);
                        });
                    }
                });
            }

            if (__$__.ASTTransforms.Loop[node.type] && node.loc && node.body.type !== "BlockStatement") {
                if (node.type === 'ArrowFunctionExpression') {
                    let retStmt = b.ReturnStatement(node.body);
                    retStmt.loc = node.body.loc;
                    node.body = b.BlockStatement([retStmt]);
                    node.expression = false;
                } else
                    node.body = b.BlockStatement([node.body]);
            }


            if (node.type === 'ForStatement' || node.type === 'ForInStatement') {
                env.push(new __$__.Probe.BlockFlame());
            }
            return [id, env.Variables()];
        },
        leave(node, path, enterData) {
            let data = enterData[id];

            if (node.type === 'VariableDeclarator') {
				let parent = path[path.length - 2];
				env.addVariable(node.id.name, parent.kind, true);
			}

            if (__$__.ASTTransforms.varScopes[node.type]) {
                env.pop();
            }

            if (node.loc && __$__.ASTTransforms.stmtTypes[node.type] || node.type === 'VariableDeclarator') {
                let start = node.loc.start;
                let end = node.loc.end;
                let parent = path[path.length - 2];
                let variables = env.Variables();


                let checkPoint = function(loc, variables, temp_var) {
                    __$__.Context.CheckPointTable[__$__.ASTTransforms.checkPoint_idCounter] = loc;
                    return b.ExpressionStatement(
                        b.CallExpression(
                            b.Identifier('__$__.Context.CheckPoint'),
                            [
                                b.Identifier('__objs'),
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__loopLabels'),
                                        b.Identifier('last')
                                    ),
                                    []
                                ),
                                b.Identifier('__loopCount'),
                                b.Identifier('__time_counter++'),
                                b.Identifier(__$__.ASTTransforms.checkPoint_idCounter++),
                                b.ObjectExpression(
                                    variables.map(function(val) {
                                        let new_val = (val === temp_var) ? '__temp_' + val : val;
                                        return b.Property(
                                            b.Identifier(val),
                                            b.ConditionalExpression(
                                                b.BinaryExpression(
                                                    b.UnaryExpression(
                                                        'typeof',
                                                        b.Identifier(new_val),
                                                        true
                                                    ),
                                                    '!==',
                                                    b.Literal('string')
                                                ),
                                                b.Identifier(new_val),
                                                b.Identifier("undefined")
                                            )
                                        );
                                    }).concat([
                                        b.Property(
                                            b.Identifier('this'),
                                            b.Identifier('this')
                                        )
                                    ])
                                ),
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.Identifier('__newExpInfo'),
                                        b.Identifier('last')
                                    ), []
                                ),
                                // __stackForCallTree.last().getContextSensitiveID();
                                b.CallExpression(
                                    b.MemberExpression(
                                        b.CallExpression(
                                            b.MemberExpression(
                                                b.Identifier('__stackForCallTree'),
                                                b.Identifier('last')
                                            ),
                                            []
                                        ),
                                        b.Identifier('getContextSensitiveID')
                                    ),
                                    []
                                )
                            ]
                        )
                    )
                };

                let changedGraphStmt = () => b.ExpressionStatement(
                    b.AssignmentExpression(
                        b.MemberExpression(
                            b.MemberExpression(
                                b.Identifier('__$__'),
                                b.Identifier('Context')
                            ),
                            b.Identifier('ChangedGraph')
                        ),
                        '=',
                        b.Literal(true)
                    )
                );
                

                /**
                 * // before
                 * return ret;
                 *
                 * // after
                 * {
                 *     checkpoint;
                 *     let __temp = ret;
                 *     return __temp;
                 *     checkpoint;
                 * }
                 */
                if (node.type === 'ReturnStatement') {
                    __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
                    __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
                    return b.BlockStatement([
                        checkPoint(start, variables),
                        b.VariableDeclaration([
                            b.VariableDeclarator(
                                b.Identifier('__temp'),
                                node.argument
                            )
                        ], 'let'),
                        b.ReturnStatement(
                            b.Identifier('__temp')
                        ),
                        checkPoint(end, variables)
                    ]);

                /**
                 * // before
                 * continue label; (or break label;)
                 *
                 * // after
                 * {
                 *     checkpoint;
                 *     continue label; (or break label;)
                 *     checkpoint;
                 * }
                 */
                } else if (('ContinueStatement' === node.type || 'BreakStatement' === node.type) && node.label && node.label.name) {
                    __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
                    __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
                    return b.BlockStatement([
                        checkPoint(start, variables),
                        Object.assign({}, node),
                        checkPoint(end, variables)
                    ]);

                /**
                 * // before
                 * continue; (or break;)
                 *
                 * // after
                 * {
                 *     checkpoint;
                 *     continue; (or break;)
                 *     checkpoint;
                 * }
                 */
                } else if ('ContinueStatement' === node.type || 'BreakStatement' === node.type) {
                    __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
                    __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
                    return b.BlockStatement([
                        checkPoint(start, data),
                        Object.assign({}, node),
                        checkPoint(end, variables)
                    ]);
                } else if (node.type === 'VariableDeclaration' && node.kind !== 'var' && ('ForStatement' !== parent.type && 'ForInStatement' !== parent.type || parent.init !== node && parent.left !== node)
                           || node.type === 'ClassDeclaration') {
                    __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
                    __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
                    return [
                        checkPoint(start, data),
                        Object.assign({}, node),
                        changedGraphStmt(),
                        checkPoint(end, variables)
                    ];
                } else if (node.type === 'VariableDeclarator') {
                    if (node.init) {
                        __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
                        __$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
                        let expression = Object.assign({}, node.init);
                        let name = node.id.name;

                        node.init = b.CallExpression(
                            b.ArrowFunctionExpression(
                                [],
                                b.BlockStatement([
                                    checkPoint(node.init.loc.start, data),
                                    b.VariableDeclaration([
                                        b.VariableDeclarator(
                                            b.Identifier('__temp_' + name),
                                            expression
                                        )
                                    ], 'var'),
                                    changedGraphStmt(),
                                    checkPoint(node.init.loc.end, variables, name),
                                    b.ReturnStatement(
                                        b.Identifier('__temp_' + name)
                                    )
                                ])
                            ),
                            []
                        );
                    }
                } else if (node.type !== 'VariableDeclaration' || ('ForStatement' !== parent.type && 'ForInStatement' !== parent.type || parent.init !== node && parent.left !== node)) {
					// So that the body of 'LabeledStatement' is not checkpoint(CallExpression).
					if (!__$__.ASTTransforms.loopTypes[node.type] || parent.type !== 'LabeledStatement') {
						let parent = path[path.length - 2];
						if (parent && (parent.type === 'BlockStatement' || parent.type === 'Program')) {
							if (node.type === 'BlockStatement') {
								__$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
								__$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
								return [
									changedGraphStmt(),
									checkPoint(start, variables),
									Object.assign({}, node),
									changedGraphStmt(),
									checkPoint(end, variables)
								];
							} else {
								__$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
								__$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
								return [
									checkPoint(start, variables),
									Object.assign({}, node),
									changedGraphStmt(),
									checkPoint(end, variables)
								];
							}
						}

						if (node.type === 'BlockStatement') {
							__$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
							__$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
							return b.BlockStatement([
								changedGraphStmt(),
								checkPoint(start, variables),
								Object.assign({}, node),
								changedGraphStmt(),
								checkPoint(end, variables)
							]);
						} else {
							__$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter] = __$__.ASTTransforms.checkPoint_idCounter + 1;
							__$__.ASTTransforms.pairCPID[__$__.ASTTransforms.checkPoint_idCounter + 1] = __$__.ASTTransforms.checkPoint_idCounter;
							return b.BlockStatement([
								checkPoint(start, variables),
								Object.assign({}, node),
								changedGraphStmt(),
								checkPoint(end, variables)
							]);
						}
					}
				}
            }
        }
    };
};
