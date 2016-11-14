window.CodeConversion = {};


/**
 * memo: code(string) -> ast -> new ast -> code(string)
 *
 * @param {string} code
 * @param {boolean} isContext
 *
 * First, user code is converted into AST using esprima parser.
 * Second, we define visitors to use walkAST(),
 * and executes walkAST() using the visitors.
 * Finally, AST is converted into code whose type is string using escodegen.
 * (walkAST() is executed twice if 'isContext' is true.)
 */
CodeConversion.transformCode = function(code, isContext = false) {
    try {
        let ast = esprima.parse(code, {loc: true});
    
        let visitors = [];

        // var visualizeVariables = [];
        // visitors.push(ASTTransforms.CheckVisualizeVariable(visualizeVariables));
        // walkAST(ast, null, visitors);
        // visitors = [];
        var visualizeVariables = [];

        if (isContext) {
            visitors.push(ASTTransforms.InsertCheckPoint(visualizeVariables));
        } else {
            visitors.push(ASTTransforms.RemoveVisualizeVariable());
        }
        walkAST(ast, null, visitors);
        visitors = [];

        if (visualizeVariables.length) visitors.push(ASTTransforms.AddVisualizeVariablesDeclaration(visualizeVariables));
        visitors.push(ASTTransforms.AddLoopCounter());
        visitors.push(ASTTransforms.AddLoopId_and_LoopCount());
        visitors.push(ASTTransforms.AddCounter());
        visitors.push(ASTTransforms.Add__objsCode());
        visitors.push(ASTTransforms.Context());
        visitors.push(ASTTransforms.NewExpressionToFunction());

        walkAST(ast, null, visitors);

        return escodegen.generate(ast);
    } catch (e) {}
};
