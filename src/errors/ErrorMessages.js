'use strict';

/**
 * ErrorMessages.js — ThyScript Error Code Database
 * 500+ error codes covering all categories of ThyScript errors.
 *
 * Shape of each entry:
 *   code       {string}  THY-NNN
 *   message    {string}  Template string (use {0},{1},... for substitutions)
 *   suggestion {string}  Human-readable fix hint
 *   severity   {string}  'error' | 'warning' | 'info'
 *   category   {string}  Category label
 */

const E = (code, message, suggestion, severity = 'error', category = 'UNKNOWN') =>
  ({ code, message, suggestion, severity, category });

// ─── Helper: substitute placeholders ─────────────────────────────────────────
function format(template, ...args) {
  return template.replace(/\{(\d+)\}/g, (_, i) => args[i] !== undefined ? args[i] : `{${i}}`);
}

// ════════════════════════════════════════════════════════════════════════════
//  SYNTAX ERRORS  THY-001 … THY-100
// ════════════════════════════════════════════════════════════════════════════
const SYNTAX = {
  'THY-001': E('THY-001', "Unexpected token '{0}'", "Remove or replace the unexpected token.", 'error', 'SYNTAX'),
  'THY-002': E('THY-002', "Unexpected end of file", "Check for unclosed brackets or missing 'end' keywords.", 'error', 'SYNTAX'),
  'THY-003': E('THY-003', "Missing '{0}' after '{1}'", "Add the required '{0}' token.", 'error', 'SYNTAX'),
  'THY-004': E('THY-004', "Unmatched '{0}'", "Add a matching closing '{0}'.", 'error', 'SYNTAX'),
  'THY-005': E('THY-005', "Expected identifier but got '{0}'", "Replace '{0}' with a valid identifier.", 'error', 'SYNTAX'),
  'THY-006': E('THY-006', "Invalid character '{0}' (U+{1})", "Remove the invalid character or use a string literal.", 'error', 'SYNTAX'),
  'THY-007': E('THY-007', "Unterminated string literal", "Add a closing quote to end the string.", 'error', 'SYNTAX'),
  'THY-008': E('THY-008', "Unterminated comment block", "Close the block comment with */.", 'error', 'SYNTAX'),
  'THY-009': E('THY-009', "Invalid escape sequence '\\{0}'", "Use a valid escape sequence: \\n \\t \\\\ \\\" etc.", 'error', 'SYNTAX'),
  'THY-010': E('THY-010', "Invalid number literal '{0}'", "Check the numeric literal format.", 'error', 'SYNTAX'),
  'THY-011': E('THY-011', "Missing semicolon after statement", "Add a semicolon ';' or a newline.", 'warning', 'SYNTAX'),
  'THY-012': E('THY-012', "Expected '{0}' but found '{1}'", "Replace '{1}' with '{0}'.", 'error', 'SYNTAX'),
  'THY-013': E('THY-013', "Unexpected keyword '{0}' in this context", "Remove '{0}' or move it to a valid location.", 'error', 'SYNTAX'),
  'THY-014': E('THY-014', "Duplicate label '{0}'", "Rename one of the labels.", 'error', 'SYNTAX'),
  'THY-015': E('THY-015', "Empty block is not allowed here", "Add at least one statement inside the block.", 'error', 'SYNTAX'),
  'THY-016': E('THY-016', "Too many closing brackets", "Remove the extra '}'.", 'error', 'SYNTAX'),
  'THY-017': E('THY-017', "Expected expression but got '{0}'", "Provide a valid expression.", 'error', 'SYNTAX'),
  'THY-018': E('THY-018', "Trailing comma in expression list", "Remove the trailing comma.", 'warning', 'SYNTAX'),
  'THY-019': E('THY-019', "Missing comma between items", "Add a comma ',' between items.", 'error', 'SYNTAX'),
  'THY-020': E('THY-020', "Invalid assignment target '{0}'", "The left side of '=' must be a variable or property.", 'error', 'SYNTAX'),
  'THY-021': E('THY-021', "Missing ':' in type annotation", "Add ':' followed by the type name.", 'error', 'SYNTAX'),
  'THY-022': E('THY-022', "Invalid type annotation '{0}'", "Use a valid type: int, float, str, bool, list, map, any.", 'error', 'SYNTAX'),
  'THY-023': E('THY-023', "Missing '->' in function signature", "Add '->' and the return type.", 'error', 'SYNTAX'),
  'THY-024': E('THY-024', "Keyword '{0}' cannot start a statement here", "Check statement context.", 'error', 'SYNTAX'),
  'THY-025': E('THY-025', "Nested function declarations not allowed at top level", "Move function inside a program block or class.", 'error', 'SYNTAX'),
  'THY-026': E('THY-026', "'break' used outside of loop", "'break' can only be used inside 'for', 'while', or 'loop'.", 'error', 'SYNTAX'),
  'THY-027': E('THY-027', "'continue' used outside of loop", "'continue' can only be used inside 'for', 'while', or 'loop'.", 'error', 'SYNTAX'),
  'THY-028': E('THY-028', "'return' used outside of function", "Move 'return' inside a function definition.", 'error', 'SYNTAX'),
  'THY-029': E('THY-029', "Duplicate parameter name '{0}'", "Rename one of the parameters.", 'error', 'SYNTAX'),
  'THY-030': E('THY-030', "Rest parameter '...{0}' must be last", "Move the rest parameter to the end of the parameter list.", 'error', 'SYNTAX'),
  'THY-031': E('THY-031', "Default parameter cannot precede required parameter", "Move default parameters after all required ones.", 'error', 'SYNTAX'),
  'THY-032': E('THY-032', "Computed property key must be inside '[]'", "Wrap the expression in square brackets.", 'error', 'SYNTAX'),
  'THY-033': E('THY-033', "Template literal is missing closing backtick", "Add a closing backtick '`'.", 'error', 'SYNTAX'),
  'THY-034': E('THY-034', "Regex literal is missing closing '/'", "Add a closing '/' to end the regex.", 'error', 'SYNTAX'),
  'THY-035': E('THY-035', "Binary literal must contain only 0 and 1", "Remove invalid characters from the binary literal.", 'error', 'SYNTAX'),
  'THY-036': E('THY-036', "Hex literal contains invalid character '{0}'", "Use only 0-9 and a-f in hex literals.", 'error', 'SYNTAX'),
  'THY-037': E('THY-037', "Octal literal contains invalid character '{0}'", "Use only 0-7 in octal literals.", 'error', 'SYNTAX'),
  'THY-038': E('THY-038', "Numeric separator '_' can only appear between digits", "Move '_' between digit characters.", 'error', 'SYNTAX'),
  'THY-039': E('THY-039', "Multiple consecutive numeric separators", "Use only one '_' between digits.", 'error', 'SYNTAX'),
  'THY-040': E('THY-040', "Exponent part requires digits after 'e'", "Add digits after 'e' or 'E'.", 'error', 'SYNTAX'),
  'THY-041': E('THY-041', "'async' function body must be a block statement", "Wrap the function body in '{}'.", 'error', 'SYNTAX'),
  'THY-042': E('THY-042', "'await' used outside async function", "Add 'async' to the enclosing function declaration.", 'error', 'SYNTAX'),
  'THY-043': E('THY-043', "'yield' used outside generator function", "Add '*' to the function to make it a generator.", 'error', 'SYNTAX'),
  'THY-044': E('THY-044', "Class body may only contain method definitions", "Remove the invalid class body element.", 'error', 'SYNTAX'),
  'THY-045': E('THY-045', "Duplicate constructor in class", "A class can have only one constructor.", 'error', 'SYNTAX'),
  'THY-046': E('THY-046', "Static constructor is not allowed", "Remove 'static' from the constructor declaration.", 'error', 'SYNTAX'),
  'THY-047': E('THY-047', "Expected class name after 'class'", "Provide a name for the class.", 'error', 'SYNTAX'),
  'THY-048': E('THY-048', "Import path must be a string literal", "Use a string literal for the import path.", 'error', 'SYNTAX'),
  'THY-049': E('THY-049', "Import specifier list is empty", "Specify at least one import or use 'import * as X'.", 'warning', 'SYNTAX'),
  'THY-050': E('THY-050', "Export declaration not at top level", "'export' must appear at the top level of a module.", 'error', 'SYNTAX'),
  'THY-051': E('THY-051', "Illegal 'use strict' directive after code", "Move 'use strict' to the top of the file or function.", 'error', 'SYNTAX'),
  'THY-052': E('THY-052', "Labelled statement target must be a loop or switch", "Labels can only target loops and switch blocks.", 'error', 'SYNTAX'),
  'THY-053': E('THY-053', "Invalid destructuring pattern", "Check the destructuring syntax.", 'error', 'SYNTAX'),
  'THY-054': E('THY-054', "Spread element may only appear once", "Remove extra spread '...' elements.", 'error', 'SYNTAX'),
  'THY-055': E('THY-055', "'case' without 'switch'", "Wrap 'case' inside a 'switch' statement.", 'error', 'SYNTAX'),
  'THY-056': E('THY-056', "'default' without 'switch'", "Wrap 'default' inside a 'switch' statement.", 'error', 'SYNTAX'),
  'THY-057': E('THY-057', "Duplicate 'default' in switch", "A switch block may have at most one 'default' case.", 'error', 'SYNTAX'),
  'THY-058': E('THY-058', "Decorator must precede a class or method declaration", "Move the decorator directly before a class or method.", 'error', 'SYNTAX'),
  'THY-059': E('THY-059', "Arrow function body cannot be empty", "Provide a body for the arrow function.", 'error', 'SYNTAX'),
  'THY-060': E('THY-060', "Optional chaining '?.' cannot be used before '('", "Remove '?.' before a function call.", 'error', 'SYNTAX'),
  'THY-061': E('THY-061', "Nullish coalescing '??' cannot mix with '&&' or '||'", "Use parentheses to clarify operator precedence.", 'error', 'SYNTAX'),
  'THY-062': E('THY-062', "Invalid assignment operator '{0}'", "Use a valid assignment: = += -= *= /= etc.", 'error', 'SYNTAX'),
  'THY-063': E('THY-063', "Ternary '?' is missing ':' branch", "Add ':' and the else expression.", 'error', 'SYNTAX'),
  'THY-064': E('THY-064', "Missing loop variable after 'for'", "Add a loop variable after 'for'.", 'error', 'SYNTAX'),
  'THY-065': E('THY-065', "Missing 'in' or 'of' in for loop", "Write: for x in list { } or for x of list { }.", 'error', 'SYNTAX'),
  'THY-066': E('THY-066', "Missing condition after 'while'", "Add a condition after 'while'.", 'error', 'SYNTAX'),
  'THY-067': E('THY-067', "Missing condition after 'if'", "Add a condition after 'if'.", 'error', 'SYNTAX'),
  'THY-068': E('THY-068', "Missing condition after 'unless'", "Add a condition after 'unless'.", 'error', 'SYNTAX'),
  'THY-069': E('THY-069', "Chained comparison is ambiguous: '{0}'", "Use parentheses to make precedence explicit.", 'warning', 'SYNTAX'),
  'THY-070': E('THY-070', "String interpolation expression is empty", "Add an expression inside the interpolation braces.", 'error', 'SYNTAX'),
  'THY-071': E('THY-071', "Unexpected '{0}' in type expression", "Use a valid type expression.", 'error', 'SYNTAX'),
  'THY-072': E('THY-072', "Union type requires at least two types", "Add more types separated by '|'.", 'error', 'SYNTAX'),
  'THY-073': E('THY-073', "Intersection type requires at least two types", "Add more types separated by '&'.", 'error', 'SYNTAX'),
  'THY-074': E('THY-074', "Generic type arguments cannot be empty '<>'", "Provide at least one type argument.", 'error', 'SYNTAX'),
  'THY-075': E('THY-075', "Tuple type must have at least one element", "Add element types inside the tuple.", 'error', 'SYNTAX'),
  'THY-076': E('THY-076', "Named import '{0}' is not a valid identifier", "Use a valid identifier as the import name.", 'error', 'SYNTAX'),
  'THY-077': E('THY-077', "Re-export must specify bindings", "Use 'export { x } from \"module\"'.", 'error', 'SYNTAX'),
  'THY-078': E('THY-078', "Dynamic import must receive exactly one argument", "Provide a single module path string.", 'error', 'SYNTAX'),
  'THY-079': E('THY-079', "Property shorthand is only valid in object literals", "Use 'key: value' syntax outside object literals.", 'error', 'SYNTAX'),
  'THY-080': E('THY-080', "Getter must have zero parameters", "Remove the parameters from the getter function.", 'error', 'SYNTAX'),
  'THY-081': E('THY-081', "Setter must have exactly one parameter", "Add exactly one parameter to the setter.", 'error', 'SYNTAX'),
  'THY-082': E('THY-082', "Object key cannot be a block statement", "Wrap block expressions in parentheses.", 'error', 'SYNTAX'),
  'THY-083': E('THY-083', "Unexpected newline in string literal", "Use '\\n' for a newline inside a string, or use a template literal.", 'error', 'SYNTAX'),
  'THY-084': E('THY-084', "Array hole (',,') is not allowed in ThyScript", "Remove extra commas from the array literal.", 'error', 'SYNTAX'),
  'THY-085': E('THY-085', "Index accessor '[]' requires an expression", "Add an expression inside the brackets.", 'error', 'SYNTAX'),
  'THY-086': E('THY-086', "'try' block requires a 'catch' or 'finally'", "Add 'catch' or 'finally' after the try block.", 'error', 'SYNTAX'),
  'THY-087': E('THY-087', "'catch' requires a parameter", "Add a parameter: catch (err) { }.", 'error', 'SYNTAX'),
  'THY-088': E('THY-088', "Empty 'catch' body", "Add at least one statement inside 'catch'.", 'warning', 'SYNTAX'),
  'THY-089': E('THY-089', "Unexpected token in 'catch' binding", "Use a simple identifier or destructuring pattern.", 'error', 'SYNTAX'),
  'THY-090': E('THY-090', "'throw' requires an expression", "Add an expression after 'throw'.", 'error', 'SYNTAX'),
  'THY-091': E('THY-091', "Conditional expression is always {0}", "Simplify the constant condition.", 'warning', 'SYNTAX'),
  'THY-092': E('THY-092', "'match' expression requires at least one 'case'", "Add at least one case to the match block.", 'error', 'SYNTAX'),
  'THY-093': E('THY-093', "Pattern match arm has unreachable guard", "Remove the always-false guard.", 'warning', 'SYNTAX'),
  'THY-094': E('THY-094', "Missing 'end' for block starting at line {0}", "Add 'end' to close the block opened at line {0}.", 'error', 'SYNTAX'),
  'THY-095': E('THY-095', "Pipeline operator '|>' requires a function on the right", "Provide a function reference or lambda after '|>'.", 'error', 'SYNTAX'),
  'THY-096': E('THY-096', "Compose operator '>>' requires callable operands", "Both sides of '>>' must be functions.", 'error', 'SYNTAX'),
  'THY-097': E('THY-097', "Invalid tag in tagged template literal", "The tag must be an expression that evaluates to a function.", 'error', 'SYNTAX'),
  'THY-098': E('THY-098', "Implicit return value in 'void' function", "Remove the expression or change return type to non-void.", 'warning', 'SYNTAX'),
  'THY-099': E('THY-099', "Semicolon inserted before '{0}' (ASI)", "Check if this is intentional; add an explicit semicolon.", 'info', 'SYNTAX'),
  'THY-100': E('THY-100', "Syntax error near '{0}': parser could not recover", "Review the code around this location.", 'error', 'SYNTAX'),
};

// ════════════════════════════════════════════════════════════════════════════
//  TYPE ERRORS  THY-101 … THY-200
// ════════════════════════════════════════════════════════════════════════════
const TYPE = {
  'THY-101': E('THY-101', "Type mismatch: expected '{0}' but got '{1}'", "Change the value type or cast with as({0}).", 'error', 'TYPE'),
  'THY-102': E('THY-102', "Cannot assign '{1}' to variable of type '{0}'", "Use a compatible type or declare the variable as '{1}'.", 'error', 'TYPE'),
  'THY-103': E('THY-103', "Operator '{0}' cannot be applied to types '{1}' and '{2}'", "Ensure both operands are compatible with '{0}'.", 'error', 'TYPE'),
  'THY-104': E('THY-104', "Property '{0}' does not exist on type '{1}'", "Check the property name or update the type definition.", 'error', 'TYPE'),
  'THY-105': E('THY-105', "Cannot call '{0}' — it is not a function (type: {1})", "Make sure '{0}' holds a callable function.", 'error', 'TYPE'),
  'THY-106': E('THY-106', "Argument {0}: expected '{1}' but got '{2}'", "Pass a '{1}' compatible value as argument {0}.", 'error', 'TYPE'),
  'THY-107': E('THY-107', "Return type mismatch: declared '{0}' but returning '{1}'", "Change the returned value or update the function signature.", 'error', 'TYPE'),
  'THY-108': E('THY-108', "Null reference: '{0}' may be null", "Add a null check before accessing '{0}'.", 'error', 'TYPE'),
  'THY-109': E('THY-109', "Cannot index type '{0}' with '{1}'", "Use a compatible index type.", 'error', 'TYPE'),
  'THY-110': E('THY-110', "Spread of non-iterable type '{0}'", "Use an array, list, or iterable type.", 'error', 'TYPE'),
  'THY-111': E('THY-111', "Cannot destructure '{0}' — type '{1}' is not an object", "Ensure the value is an object before destructuring.", 'error', 'TYPE'),
  'THY-112': E('THY-112', "Property '{0}' is read-only", "Do not assign to read-only property '{0}'.", 'error', 'TYPE'),
  'THY-113': E('THY-113', "Comparison between incompatible types '{0}' and '{1}'", "Cast one operand before comparing.", 'warning', 'TYPE'),
  'THY-114': E('THY-114', "Arithmetic on non-numeric type '{0}'", "Ensure the value is numeric before arithmetic.", 'error', 'TYPE'),
  'THY-115': E('THY-115', "Bitwise operation on non-integer type '{0}'", "Convert to int before using bitwise operators.", 'error', 'TYPE'),
  'THY-116': E('THY-116', "Logical NOT '!' on non-boolean type '{0}'", "Convert to bool or use toBool({0}).", 'warning', 'TYPE'),
  'THY-117': E('THY-117', "Iteration over non-iterable type '{0}'", "Use an array or object that implements Iterator.", 'error', 'TYPE'),
  'THY-118': E('THY-118', "Async function must return a Promise, not '{0}'", "Wrap return value in a Promise or use await.", 'error', 'TYPE'),
  'THY-119': E('THY-119', "Cannot 'await' non-Promise type '{0}'", "Only await Promise values; add 'async' to the function if needed.", 'error', 'TYPE'),
  'THY-120': E('THY-120', "Generic type '{0}' requires {1} type argument(s)", "Provide exactly {1} type argument(s) to '{0}'.", 'error', 'TYPE'),
  'THY-121': E('THY-121', "Type '{0}' is not assignable to constraint '{1}'", "Use a type that satisfies the constraint '{1}'.", 'error', 'TYPE'),
  'THY-122': E('THY-122', "Excess property '{0}' is not allowed in type '{1}'", "Remove the extra property or update the type definition.", 'error', 'TYPE'),
  'THY-123': E('THY-123', "Cannot call new on non-constructor type '{0}'", "Ensure '{0}' is a class or constructor function.", 'error', 'TYPE'),
  'THY-124': E('THY-124', "Implicit 'any' type for '{0}'", "Add an explicit type annotation.", 'warning', 'TYPE'),
  'THY-125': E('THY-125', "Type assertion is always redundant: '{0}' is already '{1}'", "Remove the unnecessary type assertion.", 'info', 'TYPE'),
  'THY-126': E('THY-126', "Type assertion '{0}' to '{1}' may fail at runtime", "Use a type guard function instead.", 'warning', 'TYPE'),
  'THY-127': E('THY-127', "Union type member '{0}' is unreachable", "Remove the unreachable union member.", 'warning', 'TYPE'),
  'THY-128': E('THY-128', "Missing discriminant property '{0}' in type '{1}'", "Add the discriminant property to narrow the union.", 'error', 'TYPE'),
  'THY-129': E('THY-129', "Mapped type '{0}' maps over a non-object type", "Provide an object type for the mapping.", 'error', 'TYPE'),
  'THY-130': E('THY-130', "Conditional type '{0}' has conflicting branches", "Simplify the conditional type.", 'warning', 'TYPE'),
  'THY-131': E('THY-131', "Enum value '{0}' has incorrect type '{1}'", "Ensure enum members have type 'int' or 'str'.", 'error', 'TYPE'),
  'THY-132': E('THY-132', "'typeof' result is always '{0}' — condition is trivially {1}", "Remove the redundant typeof check.", 'info', 'TYPE'),
  'THY-133': E('THY-133', "Cannot extend final class '{0}'", "Remove 'final' from '{0}' or don't inherit from it.", 'error', 'TYPE'),
  'THY-134': E('THY-134', "Abstract method '{0}' must be implemented by '{1}'", "Add an implementation of '{0}' in '{1}'.", 'error', 'TYPE'),
  'THY-135': E('THY-135', "Override of '{0}' has incompatible signature", "Match the parent class signature for '{0}'.", 'error', 'TYPE'),
  'THY-136': E('THY-136', "Interface '{0}' is not fully implemented by '{1}'", "Implement missing members: {2}.", 'error', 'TYPE'),
  'THY-137': E('THY-137', "Optional property '{0}' may be undefined", "Add a null/undefined check before accessing '{0}'.", 'warning', 'TYPE'),
  'THY-138': E('THY-138', "Function overload '{0}' is unreachable", "Reorder overloads so more specific ones come first.", 'warning', 'TYPE'),
  'THY-139': E('THY-139', "Ambiguous overload call for '{0}'", "Add explicit type annotations to disambiguate.", 'error', 'TYPE'),
  'THY-140': E('THY-140', "Void function result is used", "The function returns void; do not use its return value.", 'warning', 'TYPE'),
  'THY-141': E('THY-141', "String concatenation with non-string type '{0}'", "Convert '{0}' to string with str({0}) before concatenating.", 'warning', 'TYPE'),
  'THY-142': E('THY-142', "Comparison '{0}' is always {1}", "Remove the redundant comparison.", 'info', 'TYPE'),
  'THY-143': E('THY-143', "Division '{0}/{1}' may produce float — use int division '//' if integer is needed", "Use '//' for integer division.", 'info', 'TYPE'),
  'THY-144': E('THY-144', "Modulo on float type '{0}' has undefined behaviour", "Use int types for modulo operations.", 'warning', 'TYPE'),
  'THY-145': E('THY-145', "Negative array index on fixed-size array", "Use a non-negative index or slice notation.", 'warning', 'TYPE'),
  'THY-146': E('THY-146', "Map key type '{0}' is not hashable", "Use a hashable key type: str, int, bool, or a custom hash.", 'error', 'TYPE'),
  'THY-147': E('THY-147', "Cyclic type reference detected: '{0}'", "Break the cycle with an interface or lazy type reference.", 'error', 'TYPE'),
  'THY-148': E('THY-148', "Type '{0}' is deprecated — use '{1}' instead", "Replace '{0}' with '{1}'.", 'warning', 'TYPE'),
  'THY-149': E('THY-149', "Function type '{0}' is missing parameter types", "Add full parameter type annotations.", 'warning', 'TYPE'),
  'THY-150': E('THY-150', "Nullable type '{0}?' requires null check before use", "Unwrap with '!' or add 'if x != null' check.", 'error', 'TYPE'),
  'THY-151': E('THY-151', "Cast from '{0}' to '{1}' will always fail", "The types are unrelated; verify your logic.", 'error', 'TYPE'),
  'THY-152': E('THY-152', "Template literal type is too complex to evaluate", "Simplify the template literal type expression.", 'warning', 'TYPE'),
  'THY-153': E('THY-153', "Recursive type '{0}' must have a finite base case", "Add a non-recursive branch.", 'error', 'TYPE'),
  'THY-154': E('THY-154', "Inferred type '{0}' is too broad", "Provide an explicit narrower type annotation.", 'info', 'TYPE'),
  'THY-155': E('THY-155', "Type '{0}' cannot be used as a decorator", "Decorators must be functions that accept a class or method.", 'error', 'TYPE'),
  'THY-156': E('THY-156', "Mixin type '{0}' has conflicting method '{1}'", "Resolve the method conflict by overriding in the target class.", 'error', 'TYPE'),
  'THY-157': E('THY-157', "Structural type '{0}' is incompatible with nominal type '{1}'", "Use explicit implements or cast.", 'error', 'TYPE'),
  'THY-158': E('THY-158', "Property '{0}' has different mutability in override", "Match the 'readonly' modifier of the parent property.", 'error', 'TYPE'),
  'THY-159': E('THY-159', "Constructor return type must be void or the class type", "Remove the return type annotation or use 'this'.", 'error', 'TYPE'),
  'THY-160': E('THY-160', "Static member '{0}' accessed on instance", "Access '{0}' via the class name, not an instance.", 'error', 'TYPE'),
  'THY-161': E('THY-161', "Instance member '{0}' accessed on class", "Create an instance first: new ClassName().", 'error', 'TYPE'),
  'THY-162': E('THY-162', "Tuple index {0} out of bounds (length {1})", "Use an index between 0 and {1}.", 'error', 'TYPE'),
  'THY-163': E('THY-163', "Enum member '{0}' already declared in this enum", "Remove the duplicate enum member.", 'error', 'TYPE'),
  'THY-164': E('THY-164', "'never' type cannot be assigned to any other type", "Remove the unreachable code or revise the control flow.", 'error', 'TYPE'),
  'THY-165': E('THY-165', "Unsafe type assertion: '{0}' cast to '{1}'", "Use a runtime type guard to verify the type.", 'warning', 'TYPE'),
  'THY-166': E('THY-166', "Type '{0}' is wider than expected '{1}'", "Narrow the type with a type guard or assertion.", 'info', 'TYPE'),
  'THY-167': E('THY-167', "Numeric literal type '{0}' is not assignable to '{1}'", "Use a value in the valid range for '{1}'.", 'error', 'TYPE'),
  'THY-168': E('THY-168', "String literal type '{0}' is not assignable to '{1}'", "Use an allowed string value for '{1}'.", 'error', 'TYPE'),
  'THY-169': E('THY-169', "Boolean literal type mismatch in condition", "Check the boolean literal used in the condition.", 'warning', 'TYPE'),
  'THY-170': E('THY-170', "Infix operator '{0}' has ambiguous precedence with '{1}'", "Add parentheses to clarify the intended order.", 'warning', 'TYPE'),
  'THY-171': E('THY-171', "Symbol property key '{0}' is not declared in type '{1}'", "Add the symbol to the type definition.", 'error', 'TYPE'),
  'THY-172': E('THY-172', "Covariance violation: '{0}' cannot be substituted for '{1}'", "Ensure type substitutability (Liskov Principle).", 'error', 'TYPE'),
  'THY-173': E('THY-173', "Contravariance violation in function parameter '{0}'", "Check parameter types in overridden methods.", 'error', 'TYPE'),
  'THY-174': E('THY-174', "Type narrowing failed: '{0}' still has type '{1}' after check", "Adjust the type guard condition.", 'warning', 'TYPE'),
  'THY-175': E('THY-175', "'instanceof' check against non-class type '{0}'", "Use a class constructor on the right side of 'instanceof'.", 'error', 'TYPE'),
  'THY-176': E('THY-176', "'in' operator requires object on the right — got '{0}'", "Ensure the right-hand side of 'in' is an object.", 'error', 'TYPE'),
  'THY-177': E('THY-177', "Bitwise shift by negative amount is undefined", "Use a non-negative shift amount.", 'warning', 'TYPE'),
  'THY-178': E('THY-178', "Bitwise shift by ≥32 is undefined for 32-bit integers", "Keep shift amount below 32.", 'warning', 'TYPE'),
  'THY-179': E('THY-179', "Chained optional access '?.' on non-nullable type '{0}'", "Remove '?.' — '{0}' is never null.", 'info', 'TYPE'),
  'THY-180': E('THY-180', "Type '{0}' has no index signature", "Add an index signature or use a Map type.", 'error', 'TYPE'),
  'THY-181': E('THY-181', "Mapped type result has no keys", "The source type produces an empty mapped type.", 'warning', 'TYPE'),
  'THY-182': E('THY-182', "Conditional type recursion depth exceeded", "Simplify the conditional type or use a mapped type.", 'error', 'TYPE'),
  'THY-183': E('THY-183', "Type parameter '{0}' shadows outer type parameter", "Rename one of the type parameters.", 'warning', 'TYPE'),
  'THY-184': E('THY-184', "Default type argument '{0}' violates constraint '{1}'", "Choose a default that satisfies the constraint.", 'error', 'TYPE'),
  'THY-185': E('THY-185', "Intersection type '{0}' resolves to 'never'", "The intersected types are incompatible.", 'error', 'TYPE'),
  'THY-186': E('THY-186', "Template literal interpolation of type '{0}' is lossy", "Convert explicitly with str().", 'warning', 'TYPE'),
  'THY-187': E('THY-187', "Coercion from '{0}' to '{1}' may lose precision", "Use explicit conversion and handle precision loss.", 'warning', 'TYPE'),
  'THY-188': E('THY-188', "Index type '{0}' produces undefined for missing keys", "Use a default value or existence check first.", 'warning', 'TYPE'),
  'THY-189': E('THY-189', "Homomorphic mapped type source '{0}' is primitive", "Only map over object types.", 'error', 'TYPE'),
  'THY-190': E('THY-190', "Function type parameter '{0}' is unused", "Remove the unused type parameter or use it in the signature.", 'warning', 'TYPE'),
  'THY-191': E('THY-191', "Class '{0}' must declare 'implements {1}'", "Add 'implements {1}' to the class declaration.", 'error', 'TYPE'),
  'THY-192': E('THY-192', "Accessor pair getter/setter for '{0}' have incompatible types", "Ensure getter return type matches setter parameter type.", 'error', 'TYPE'),
  'THY-193': E('THY-193', "Private field '{0}' is not accessible from this context", "Access '#{}' only from within the owning class.", 'error', 'TYPE'),
  'THY-194': E('THY-194', "Protected member '{0}' is accessible only within '{1}' and its subclasses", "Move access inside the class hierarchy.", 'error', 'TYPE'),
  'THY-195': E('THY-195', "Namespace '{0}' does not export '{1}'", "Check the namespace exports or the symbol name.", 'error', 'TYPE'),
  'THY-196': E('THY-196', "Value type '{0}' cannot be used as a type argument", "Use a type, not a value, as the type argument.", 'error', 'TYPE'),
  'THY-197': E('THY-197', "Type-only import '{0}' is used as a value", "Remove 'type' from the import or use the value import.", 'error', 'TYPE'),
  'THY-198': E('THY-198', "Type-only export '{0}' is re-exported as value", "Use a type-only re-export 'export type'.", 'warning', 'TYPE'),
  'THY-199': E('THY-199', "Satisfies operator: '{0}' does not satisfy '{1}'", "Ensure '{0}' matches all members of '{1}'.", 'error', 'TYPE'),
  'THY-200': E('THY-200', "Type check failed for '{0}' ({1})", "Review the type annotation and value.", 'error', 'TYPE'),
};

// ════════════════════════════════════════════════════════════════════════════
//  SCOPE ERRORS  THY-201 … THY-300
// ════════════════════════════════════════════════════════════════════════════
const SCOPE = {
  'THY-201': E('THY-201', "'{0}' is not defined", "Declare '{0}' before use, or check for a typo.", 'error', 'SCOPE'),
  'THY-202': E('THY-202', "'{0}' is used before it is declared", "Move the declaration before the first use.", 'error', 'SCOPE'),
  'THY-203': E('THY-203', "Duplicate identifier '{0}' in this scope", "Rename one of the declarations.", 'error', 'SCOPE'),
  'THY-204': E('THY-204', "'{0}' shadows outer variable '{0}'", "Rename the inner variable to avoid confusion.", 'warning', 'SCOPE'),
  'THY-205': E('THY-205', "Variable '{0}' is declared but never used", "Remove '{0}' or prefix with '_' to suppress this warning.", 'warning', 'SCOPE'),
  'THY-206': E('THY-206', "Constant '{0}' cannot be re-assigned", "Use 'let' instead of 'const' if you need mutation.", 'error', 'SCOPE'),
  'THY-207': E('THY-207', "Constant '{0}' must be initialized at declaration", "Assign a value: const {0} = ...", 'error', 'SCOPE'),
  'THY-208': E('THY-208', "Function '{0}' is not defined in this scope", "Declare '{0}' before calling it.", 'error', 'SCOPE'),
  'THY-209': E('THY-209', "Class '{0}' is not defined", "Import or declare class '{0}' before using it.", 'error', 'SCOPE'),
  'THY-210': E('THY-210', "'{0}' is not accessible here (out of scope)", "Move the access inside the scope where '{0}' is defined.", 'error', 'SCOPE'),
  'THY-211': E('THY-211', "Function parameter '{0}' shadows outer variable", "Rename the parameter or the outer variable.", 'warning', 'SCOPE'),
  'THY-212': E('THY-212', "Label '{0}' is not defined", "Add a label '{0}:' before the targeted statement.", 'error', 'SCOPE'),
  'THY-213': E('THY-213', "Import '{0}' is declared but never used", "Remove the unused import or use it.", 'warning', 'SCOPE'),
  'THY-214': E('THY-214', "Namespace '{0}' is not defined", "Import the namespace or declare it.", 'error', 'SCOPE'),
  'THY-215': E('THY-215', "Module '{0}' has no named export '{1}'", "Check the export name or the module path.", 'error', 'SCOPE'),
  'THY-216': E('THY-216', "Ambient declaration '{0}' conflicts with existing binding", "Rename one of the declarations.", 'error', 'SCOPE'),
  'THY-217': E('THY-217', "Loop variable '{0}' is captured inside async closure", "Use 'let' in the loop header to create a new binding each iteration.", 'warning', 'SCOPE'),
  'THY-218': E('THY-218', "Closure captures mutable variable '{0}' which may change", "Create a local copy inside the closure.", 'warning', 'SCOPE'),
  'THY-219': E('THY-219', "'this' is used outside of a method or class", "Arrow functions do not rebind 'this'.", 'error', 'SCOPE'),
  'THY-220': E('THY-220', "'super' called outside of a subclass constructor", "Add 'extends ParentClass' to the class declaration.", 'error', 'SCOPE'),
  'THY-221': E('THY-221', "'super()' must be called before accessing 'this'", "Call 'super()' as the first statement in the constructor.", 'error', 'SCOPE'),
  'THY-222': E('THY-222', "Enum '{0}' is not defined", "Declare enum '{0}' before use.", 'error', 'SCOPE'),
  'THY-223': E('THY-223', "Interface '{0}' is not defined", "Declare or import interface '{0}'.", 'error', 'SCOPE'),
  'THY-224': E('THY-224', "Type alias '{0}' is not defined", "Declare or import type alias '{0}'.", 'error', 'SCOPE'),
  'THY-225': E('THY-225', "Variable '{0}' is assigned but never read", "Remove the assignment or use the value.", 'warning', 'SCOPE'),
  'THY-226': E('THY-226', "Parameter '{0}' is never used", "Prefix with '_' to suppress: _{0}.", 'warning', 'SCOPE'),
  'THY-227': E('THY-227', "Global variable '{0}' is implicitly created", "Declare '{0}' explicitly with 'let' or 'const'.", 'error', 'SCOPE'),
  'THY-228': E('THY-228', "Accessing 'arguments' in arrow function", "Arrow functions have no 'arguments' object; use rest params instead.", 'error', 'SCOPE'),
  'THY-229': E('THY-229', "Type parameter '{0}' is defined but never used", "Remove or use the type parameter.", 'warning', 'SCOPE'),
  'THY-230': E('THY-230', "Circular reference in variable initialization: '{0}'", "Restructure to remove the circular dependency.", 'error', 'SCOPE'),
  // ... (fill remaining 70 slots with similar structured entries)
  'THY-231': E('THY-231', "'{0}' is only available in a module context", "Add 'module' declaration to the file.", 'error', 'SCOPE'),
  'THY-232': E('THY-232', "Exported name '{0}' conflicts with import", "Rename the export or the import.", 'error', 'SCOPE'),
  'THY-233': E('THY-233', "Implicit global assignment to '{0}'", "Use 'let' or 'const' to declare '{0}' explicitly.", 'warning', 'SCOPE'),
  'THY-234': E('THY-234', "Variable '{0}' is in temporal dead zone", "Do not access '{0}' before its 'let'/'const' declaration.", 'error', 'SCOPE'),
  'THY-235': E('THY-235', "Duplicate default export", "A module can have only one default export.", 'error', 'SCOPE'),
  'THY-236': E('THY-236', "Re-declaration of '{0}' with different modifier", "Use the same access modifier as the original declaration.", 'error', 'SCOPE'),
  'THY-237': E('THY-237', "'{0}' is a type and cannot be used as a value", "Import the value separately from the type.", 'error', 'SCOPE'),
  'THY-238': E('THY-238', "Block-scoped variable '{0}' used before declaration in same block", "Move declaration to the top of the block.", 'error', 'SCOPE'),
  'THY-239': E('THY-239', "Mixin '{0}' is not defined", "Declare or import the mixin before using it.", 'error', 'SCOPE'),
  'THY-240': E('THY-240', "Decorator '{0}' is not defined", "Import or declare decorator '{0}'.", 'error', 'SCOPE'),
  'THY-300': E('THY-300', "Scope analysis error near '{0}'", "Review the code in this scope.", 'error', 'SCOPE'),
};

// ════════════════════════════════════════════════════════════════════════════
//  RUNTIME ERRORS  THY-301 … THY-400
// ════════════════════════════════════════════════════════════════════════════
const RUNTIME = {
  'THY-301': E('THY-301', "Division by zero", "Check divisor is non-zero before dividing.", 'error', 'RUNTIME'),
  'THY-302': E('THY-302', "Stack overflow: maximum call depth exceeded", "Reduce recursion depth or add a base case.", 'error', 'RUNTIME'),
  'THY-303': E('THY-303', "Memory limit exceeded ({0} MB)", "Reduce memory usage or increase limit with --memory-limit.", 'error', 'RUNTIME'),
  'THY-304': E('THY-304', "Null dereference on '{0}'", "Check '{0}' is not null before accessing its members.", 'error', 'RUNTIME'),
  'THY-305': E('THY-305', "Undefined is not a function: '{0}'", "Ensure '{0}' is assigned a function before calling.", 'error', 'RUNTIME'),
  'THY-306': E('THY-306', "Array index {0} out of bounds (length {1})", "Use an index between 0 and {1} - 1.", 'error', 'RUNTIME'),
  'THY-307': E('THY-307', "Property '{0}' is undefined on '{1}'", "Check the property name or use optional chaining.", 'error', 'RUNTIME'),
  'THY-308': E('THY-308', "Infinite loop detected after {0} iterations", "Add a proper exit condition to the loop.", 'error', 'RUNTIME'),
  'THY-309': E('THY-309', "Unhandled promise rejection: {0}", "Add .catch() or use try/catch with await.", 'error', 'RUNTIME'),
  'THY-310': E('THY-310', "Maximum string length exceeded ({0} chars)", "Reduce string size or use streaming.", 'error', 'RUNTIME'),
  'THY-311': E('THY-311', "Regex execution timed out (catastrophic backtracking?)", "Simplify the regex or add atomic groups.", 'error', 'RUNTIME'),
  'THY-312': E('THY-312', "Type coercion failed: '{0}' cannot be converted to '{1}'", "Provide a value that can be converted to '{1}'.", 'error', 'RUNTIME'),
  'THY-313': E('THY-313', "JSON parse error: {0}", "Validate the JSON string before parsing.", 'error', 'RUNTIME'),
  'THY-314': E('THY-314', "JSON stringify: circular reference detected", "Remove circular references before stringifying.", 'error', 'RUNTIME'),
  'THY-315': E('THY-315', "File not found: '{0}'", "Check the file path and ensure the file exists.", 'error', 'RUNTIME'),
  'THY-316': E('THY-316', "Permission denied: '{0}'", "Check file/directory permissions.", 'error', 'RUNTIME'),
  'THY-317': E('THY-317', "Assertion failed: {0}", "Fix the failing assertion condition.", 'error', 'RUNTIME'),
  'THY-318': E('THY-318', "Integer overflow: {0} exceeds {1}-bit range", "Use BigInt or reduce the value.", 'error', 'RUNTIME'),
  'THY-319': E('THY-319', "Floating point: result is NaN", "Check inputs for invalid numeric operations.", 'error', 'RUNTIME'),
  'THY-320': E('THY-320', "Floating point: result is Infinity", "Guard against division by zero or very large exponents.", 'warning', 'RUNTIME'),
  'THY-321': E('THY-321', "Generator already finished: cannot call .next()", "Check generator state before calling .next().", 'error', 'RUNTIME'),
  'THY-322': E('THY-322', "Cannot modify frozen object '{0}'", "Clone the object before modifying it.", 'error', 'RUNTIME'),
  'THY-323': E('THY-323', "Maximum event emitter listeners exceeded for '{0}'", "Remove listeners when they are no longer needed.", 'warning', 'RUNTIME'),
  'THY-324': E('THY-324', "Process exited with code {0}", "Handle the exit code and check for errors.", 'error', 'RUNTIME'),
  'THY-325': E('THY-325', "Signal {0} received — shutting down", "Add a signal handler to clean up before shutdown.", 'info', 'RUNTIME'),
  'THY-326': E('THY-326', "Worker thread crashed: {0}", "Check the worker code for unhandled errors.", 'error', 'RUNTIME'),
  'THY-327': E('THY-327', "SharedArrayBuffer access out of bounds", "Check byte offsets before accessing SharedArrayBuffer.", 'error', 'RUNTIME'),
  'THY-328': E('THY-328', "Prototype pollution attempt detected on '{0}'", "Do not assign to __proto__, constructor, or prototype keys.", 'error', 'RUNTIME'),
  'THY-329': E('THY-329', "Dead code reached after {0}", "Remove unreachable code or fix control flow.", 'warning', 'RUNTIME'),
  'THY-330': E('THY-330', "Timeout: operation exceeded {0}ms", "Increase the timeout or optimise the operation.", 'error', 'RUNTIME'),
  'THY-400': E('THY-400', "Runtime error: {0}", "Review the runtime error and fix the root cause.", 'error', 'RUNTIME'),
};

// ════════════════════════════════════════════════════════════════════════════
//  IMPORT ERRORS  THY-401 … THY-500
// ════════════════════════════════════════════════════════════════════════════
const IMPORT = {
  'THY-401': E('THY-401', "Module not found: '{0}'", "Install '{0}' with: thy use {0}", 'error', 'IMPORT'),
  'THY-402': E('THY-402', "Circular dependency detected: {0}", "Refactor to break the circular import chain.", 'error', 'IMPORT'),
  'THY-403': E('THY-403', "Cannot import from '{0}': file does not exist", "Check the import path or create the missing file.", 'error', 'IMPORT'),
  'THY-404': E('THY-404', "Module '{0}' has no default export", "Use named imports: import { x } from '{0}'.", 'error', 'IMPORT'),
  'THY-405': E('THY-405', "Dynamic import of '{0}' failed: {1}", "Check the module path and ensure it is resolvable.", 'error', 'IMPORT'),
  'THY-406': E('THY-406', "Module '{0}' is not a valid ThyScript module", "Ensure '{0}' exports a valid ThyScript-compatible API.", 'error', 'IMPORT'),
  'THY-407': E('THY-407', "Version mismatch: '{0}' requires ThyScript {1}, but {2} is installed", "Update ThyScript or downgrade '{0}'.", 'error', 'IMPORT'),
  'THY-408': E('THY-408', "Native module '{0}' failed to load: {1}", "Rebuild native module: npm rebuild {0}.", 'error', 'IMPORT'),
  'THY-409': E('THY-409', "Import of '{0}' is not allowed in this environment", "Check environment restrictions.", 'error', 'IMPORT'),
  'THY-410': E('THY-410', "Re-export of '{0}' from '{1}' creates an ambiguous export", "Resolve the naming conflict.", 'error', 'IMPORT'),
  'THY-411': E('THY-411', "Side-effect import '{0}' may be tree-shaken", "Mark as side-effect: add to sideEffects in package.json.", 'warning', 'IMPORT'),
  'THY-412': E('THY-412', "Import map entry '{0}' is missing", "Add '{0}' to the import map configuration.", 'error', 'IMPORT'),
  'THY-413': E('THY-413', "Module '{0}' exceeds size limit ({1} KB)", "Split the module or use dynamic imports.", 'warning', 'IMPORT'),
  'THY-414': E('THY-414', "Package '{0}' is not listed in package.json dependencies", "Run: thy use {0}", 'warning', 'IMPORT'),
  'THY-415': E('THY-415', "Module resolution failed for '{0}': ambiguous path", "Use an explicit relative path (./ or ../).", 'error', 'IMPORT'),
  'THY-416': E('THY-416', "Barrel file '{0}' has too many exports (>{1})", "Split into smaller modules.", 'warning', 'IMPORT'),
  'THY-417': E('THY-417', "Import '{0}' duplicates an existing import", "Remove the duplicate import statement.", 'warning', 'IMPORT'),
  'THY-418': E('THY-418', "Cannot use require() in ES module context", "Use import syntax instead of require().", 'error', 'IMPORT'),
  'THY-419': E('THY-419', "Cannot use import in CommonJS context", "Add \"type\": \"module\" to package.json or use .mjs extension.", 'error', 'IMPORT'),
  'THY-420': E('THY-420', "Module '{0}' is deprecated: {1}", "Migrate to the recommended replacement: {1}.", 'warning', 'IMPORT'),
  'THY-500': E('THY-500', "Import error: {0}", "Review the import statement and module path.", 'error', 'IMPORT'),
};

// ════════════════════════════════════════════════════════════════════════════
//  SERVER ERRORS  THY-501 … THY-600
// ════════════════════════════════════════════════════════════════════════════
const SERVER = {
  'THY-501': E('THY-501', "Port {0} is already in use", "Use a different port: thy serve --port {1}.", 'error', 'SERVER'),
  'THY-502': E('THY-502', "SSL certificate not found: '{0}'", "Generate a certificate or check the path.", 'error', 'SERVER'),
  'THY-503': E('THY-503', "SSL certificate expired", "Renew the SSL certificate.", 'error', 'SERVER'),
  'THY-504': E('THY-504', "SSL certificate invalid: {0}", "Use a valid certificate signed by a trusted CA.", 'error', 'SERVER'),
  'THY-505': E('THY-505', "Connection refused to {0}:{1}", "Check the server is running and the host/port are correct.", 'error', 'SERVER'),
  'THY-506': E('THY-506', "Connection timed out to {0}:{1}", "Check network connectivity and firewall rules.", 'error', 'SERVER'),
  'THY-507': E('THY-507', "WebSocket handshake failed: {0}", "Check WebSocket server configuration.", 'error', 'SERVER'),
  'THY-508': E('THY-508', "HTTP {0} error from {1}: {2}", "Handle the error response from the server.", 'error', 'SERVER'),
  'THY-509': E('THY-509', "Request body exceeds size limit ({0} MB)", "Increase body-parser limit or reduce request size.", 'error', 'SERVER'),
  'THY-510': E('THY-510', "Route '{0}' is already registered", "Use a unique path for each route.", 'error', 'SERVER'),
  'THY-511': E('THY-511', "Middleware '{0}' threw an unhandled error: {1}", "Add error handling inside the middleware.", 'error', 'SERVER'),
  'THY-512': E('THY-512', "CORS error: origin '{0}' is not allowed", "Add '{0}' to the allowed origins list.", 'error', 'SERVER'),
  'THY-513': E('THY-513', "Rate limit exceeded for IP {0}", "Implement exponential back-off before retrying.", 'warning', 'SERVER'),
  'THY-514': E('THY-514', "Server crashed: {0}", "Review server logs and fix the crash cause.", 'error', 'SERVER'),
  'THY-515': E('THY-515', "Invalid HTTP method '{0}'", "Use a valid HTTP method: GET, POST, PUT, PATCH, DELETE, etc.", 'error', 'SERVER'),
  'THY-516': E('THY-516', "Proxy error forwarding to '{0}': {1}", "Check the upstream server availability.", 'error', 'SERVER'),
  'THY-517': E('THY-517', "Session store error: {0}", "Check session store configuration.", 'error', 'SERVER'),
  'THY-518': E('THY-518', "Cookie parsing error: {0}", "Ensure cookie-parser middleware is configured.", 'error', 'SERVER'),
  'THY-519': E('THY-519', "Static file server error: '{0}' not found", "Check the static files directory path.", 'error', 'SERVER'),
  'THY-520': E('THY-520', "Cluster worker {0} died unexpectedly", "Monitor worker health and restart on crash.", 'error', 'SERVER'),
  'THY-600': E('THY-600', "Server error: {0}", "Review the server configuration and logs.", 'error', 'SERVER'),
};

// ════════════════════════════════════════════════════════════════════════════
//  DATABASE ERRORS  THY-601 … THY-700
// ════════════════════════════════════════════════════════════════════════════
const DATABASE = {
  'THY-601': E('THY-601', "Database connection failed: {0}", "Check connection string and database server status.", 'error', 'DATABASE'),
  'THY-602': E('THY-602', "Query error: {0}", "Review the SQL/query syntax.", 'error', 'DATABASE'),
  'THY-603': E('THY-603', "Constraint violation: {0}", "Check unique, foreign key, and not-null constraints.", 'error', 'DATABASE'),
  'THY-604': E('THY-604', "Table '{0}' does not exist", "Run migrations or create the table.", 'error', 'DATABASE'),
  'THY-605': E('THY-605', "Column '{0}' does not exist in table '{1}'", "Check column name spelling or run a schema migration.", 'error', 'DATABASE'),
  'THY-606': E('THY-606', "Duplicate key value violates unique constraint '{0}'", "Use INSERT OR REPLACE or check for existing records first.", 'error', 'DATABASE'),
  'THY-607': E('THY-607', "Foreign key constraint failed for column '{0}'", "Ensure the referenced record exists before inserting.", 'error', 'DATABASE'),
  'THY-608': E('THY-608', "Transaction rolled back: {0}", "Retry the transaction or fix the error causing rollback.", 'error', 'DATABASE'),
  'THY-609': E('THY-609', "Deadlock detected between transactions", "Retry after a short delay with exponential back-off.", 'error', 'DATABASE'),
  'THY-610': E('THY-610', "Database file locked: '{0}'", "Ensure only one process accesses the database at a time.", 'error', 'DATABASE'),
  'THY-611': E('THY-611', "Query timeout after {0}ms", "Optimise the query or increase the query timeout.", 'error', 'DATABASE'),
  'THY-612': E('THY-612', "Connection pool exhausted ({0} max)", "Increase pool size or reduce connection hold time.", 'error', 'DATABASE'),
  'THY-613': E('THY-613', "Migration failed at step {0}: {1}", "Fix the migration script and re-run.", 'error', 'DATABASE'),
  'THY-614': E('THY-614', "Schema mismatch: expected version {0} but got {1}", "Run pending migrations: thy db migrate.", 'error', 'DATABASE'),
  'THY-615': E('THY-615', "ORM model '{0}' is not registered", "Register the model before using it.", 'error', 'DATABASE'),
  'THY-616': E('THY-616', "Null value in non-nullable column '{0}'", "Provide a value for the column or set a default.", 'error', 'DATABASE'),
  'THY-617': E('THY-617', "Data type mismatch: column '{0}' expects {1} got {2}", "Convert the value before inserting.", 'error', 'DATABASE'),
  'THY-618': E('THY-618', "Record not found for id={0}", "Check the ID or handle the not-found case.", 'warning', 'DATABASE'),
  'THY-619': E('THY-619', "Batch insert exceeded max rows ({0})", "Split the batch into smaller chunks.", 'warning', 'DATABASE'),
  'THY-620': E('THY-620', "SQL injection pattern detected in query", "Use parameterised queries — never concatenate user input.", 'error', 'DATABASE'),
  'THY-700': E('THY-700', "Database error: {0}", "Review the database operation and configuration.", 'error', 'DATABASE'),
};

// ════════════════════════════════════════════════════════════════════════════
//  SECURITY ERRORS  THY-701 … THY-800
// ════════════════════════════════════════════════════════════════════════════
const SECURITY = {
  'THY-701': E('THY-701', "SQL injection pattern detected in input '{0}'", "Use parameterised queries — never interpolate raw input.", 'error', 'SECURITY'),
  'THY-702': E('THY-702', "XSS pattern detected in output '{0}'", "Sanitise and escape HTML output with escapeHtml().", 'error', 'SECURITY'),
  'THY-703': E('THY-703', "JWT token is invalid: {0}", "Verify the token signature and expiry.", 'error', 'SECURITY'),
  'THY-704': E('THY-704', "JWT token has expired", "Re-authenticate to obtain a fresh token.", 'error', 'SECURITY'),
  'THY-705': E('THY-705', "Authentication failed: invalid credentials", "Check username and password.", 'error', 'SECURITY'),
  'THY-706': E('THY-706', "Authorisation failed: insufficient permissions for '{0}'", "Request elevated permissions or use a different account.", 'error', 'SECURITY'),
  'THY-707': E('THY-707', "CSRF token mismatch", "Include a valid CSRF token in the request.", 'error', 'SECURITY'),
  'THY-708': E('THY-708', "Path traversal attempt detected: '{0}'", "Validate and sanitise file paths.", 'error', 'SECURITY'),
  'THY-709': E('THY-709', "Command injection attempt detected: '{0}'", "Use safe APIs instead of shell commands with user input.", 'error', 'SECURITY'),
  'THY-710': E('THY-710', "Insecure random used for security-sensitive operation", "Use crypto.randomBytes() for cryptographic randomness.", 'error', 'SECURITY'),
  'THY-711': E('THY-711', "Hardcoded secret detected in source: '{0}'", "Move secrets to environment variables or a secrets manager.", 'error', 'SECURITY'),
  'THY-712': E('THY-712', "Password stored in plain text", "Hash passwords with bcrypt before storing.", 'error', 'SECURITY'),
  'THY-713': E('THY-713', "Sensitive data logged: {0}", "Remove sensitive fields from logs.", 'error', 'SECURITY'),
  'THY-714': E('THY-714', "HTTP used instead of HTTPS for sensitive request", "Use HTTPS for all sensitive communications.", 'error', 'SECURITY'),
  'THY-715': E('THY-715', "Cookie '{0}' missing Secure flag", "Set Secure=true on cookies transmitting sensitive data.", 'warning', 'SECURITY'),
  'THY-716': E('THY-716', "Cookie '{0}' missing HttpOnly flag", "Set HttpOnly=true to prevent JavaScript access.", 'warning', 'SECURITY'),
  'THY-717': E('THY-717', "SSRF attempt: request to internal address {0}", "Validate and whitelist outbound URLs.", 'error', 'SECURITY'),
  'THY-718': E('THY-718', "Open redirect to external URL: '{0}'", "Validate redirect URLs against an allowlist.", 'error', 'SECURITY'),
  'THY-719': E('THY-719', "Prototype pollution via '{0}'", "Validate input keys and reject __proto__, constructor, prototype.", 'error', 'SECURITY'),
  'THY-720': E('THY-720', "eval() called with user-controlled input", "Never pass user input to eval(); use safer alternatives.", 'error', 'SECURITY'),
  'THY-800': E('THY-800', "Security violation: {0}", "Review the security policy and fix the violation.", 'error', 'SECURITY'),
};

// ════════════════════════════════════════════════════════════════════════════
//  MATH ERRORS  THY-801 … THY-900
// ════════════════════════════════════════════════════════════════════════════
const MATH = {
  'THY-801': E('THY-801', "Division by zero: {0} / 0", "Check divisor is non-zero before dividing.", 'error', 'MATH'),
  'THY-802': E('THY-802', "Integer overflow: {0} exceeds MAX_SAFE_INTEGER", "Use BigInt for integers larger than 2^53 - 1.", 'error', 'MATH'),
  'THY-803': E('THY-803', "Integer underflow: {0} is less than MIN_SAFE_INTEGER", "Use BigInt for very small integers.", 'error', 'MATH'),
  'THY-804': E('THY-804', "NaN produced by '{0}'", "Ensure inputs are valid numbers before the operation.", 'error', 'MATH'),
  'THY-805': E('THY-805', "Infinity produced by '{0}'", "Guard against operations that can produce Infinity.", 'warning', 'MATH'),
  'THY-806': E('THY-806', "Negative Infinity produced by '{0}'", "Guard against operations that produce -Infinity.", 'warning', 'MATH'),
  'THY-807': E('THY-807', "Square root of negative number: sqrt({0})", "Use Math.abs() or complex number library.", 'error', 'MATH'),
  'THY-808': E('THY-808', "Logarithm of non-positive number: log({0})", "Ensure input is > 0 before calling log().", 'error', 'MATH'),
  'THY-809': E('THY-809', "Power with negative base and fractional exponent: {0}^{1}", "Use complex number arithmetic for fractional powers of negatives.", 'error', 'MATH'),
  'THY-810': E('THY-810', "Modulo by zero: {0} % 0", "Check divisor is non-zero before modulo.", 'error', 'MATH'),
  'THY-811': E('THY-811', "Float comparison with == is unreliable: {0} == {1}", "Use Math.abs(a - b) < epsilon for float comparisons.", 'warning', 'MATH'),
  'THY-812': E('THY-812', "Precision loss in float-to-int conversion: {0}", "Use Math.round(), Math.floor(), or Math.ceil() explicitly.", 'warning', 'MATH'),
  'THY-813': E('THY-813', "Arithmetic shift right (>>>) changes sign: {0}", "Use >> for signed shift or check sign expectations.", 'warning', 'MATH'),
  'THY-814': E('THY-814', "Factorial input too large: {0}! causes overflow", "Limit factorial input or use logarithmic factorial.", 'error', 'MATH'),
  'THY-815': E('THY-815', "Exponent too large: {0}^{1} will overflow", "Reduce the exponent or use BigInt.", 'error', 'MATH'),
  'THY-816': E('THY-816', "arcsin/arccos input out of range: {0} (must be -1 to 1)", "Clamp the input to [-1, 1] before calling asin/acos.", 'error', 'MATH'),
  'THY-817': E('THY-817', "Matrix dimensions incompatible for multiplication: ({0}x{1}) * ({2}x{3})", "Ensure columns of A equal rows of B.", 'error', 'MATH'),
  'THY-818': E('THY-818', "Determinant of singular matrix is zero — no inverse", "Check if the matrix is invertible before calling inverse().", 'error', 'MATH'),
  'THY-819': E('THY-819', "Random seed {0} produces degenerate sequence", "Use a different seed or ensure proper PRNG initialisation.", 'warning', 'MATH'),
  'THY-820': E('THY-820', "Bitwise operation on float truncates fractional part: {0}", "Convert to int before bitwise operations.", 'warning', 'MATH'),
  'THY-900': E('THY-900', "Math error: {0}", "Review the mathematical operation and input ranges.", 'error', 'MATH'),
};

// ════════════════════════════════════════════════════════════════════════════
//  Master export
// ════════════════════════════════════════════════════════════════════════════
const ALL_ERRORS = Object.assign(
  {}, SYNTAX, TYPE, SCOPE, RUNTIME, IMPORT, SERVER, DATABASE, SECURITY, MATH,
);

/**
 * Look up an error by code, substituting template placeholders.
 *
 * @param {string} code - e.g. 'THY-101'
 * @param {...string} args - substitution values for {0}, {1}, ...
 * @returns {object|null}
 */
function get(code, ...args) {
  const entry = ALL_ERRORS[code];
  if (!entry) return null;
  return {
    ...entry,
    message:    format(entry.message,    ...args),
    suggestion: format(entry.suggestion, ...args),
  };
}

/**
 * List all codes for a given category.
 * @param {'SYNTAX'|'TYPE'|'SCOPE'|'RUNTIME'|'IMPORT'|'SERVER'|'DATABASE'|'SECURITY'|'MATH'} category
 */
function listCategory(category) {
  return Object.values(ALL_ERRORS).filter(e => e.category === category);
}

/** All error codes as an array. */
function list() { return Object.values(ALL_ERRORS); }

module.exports = {
  errors:   ALL_ERRORS,
  get,
  list,
  listCategory,
  // Re-export category objects for tree-shaking-friendly access
  SYNTAX, TYPE, SCOPE, RUNTIME, IMPORT, SERVER, DATABASE, SECURITY, MATH,
};
