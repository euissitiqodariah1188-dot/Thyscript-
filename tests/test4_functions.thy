// ═══════════════════════════════════════════════════════
//  TEST 4: Functions, Closures, Error Handling
//  Menguji func, recursion, try/catch, complex logic
// ═══════════════════════════════════════════════════════

print("=== TEST 4: FUNCTIONS & ERROR HANDLING ===")

// Basic function
func greet(name):
    return "Hello, " + name + "!"
end()

const table msg = greet("ThyScript")
print(msg)

// Recursive function - factorial
func factorial(n):
    if(n <= 1):
        return 1
    end()
    return calculate(n * factorial(n - 1))
end()

print("5! = " + factorial(5))
print("10! = " + factorial(10))

// Fibonacci
func fibonacci(n):
    if(n <= 0):
        return 0
    end()
    if(n == 1):
        return 1
    end()
    return calculate(fibonacci(n - 1) + fibonacci(n - 2))
end()

print("fib(7) = " + fibonacci(7))
print("fib(10) = " + fibonacci(10))

// Function with multiple params and default logic
func clamp(value, minVal, maxVal):
    if(value < minVal):
        return minVal
    end()
    if(value > maxVal):
        return maxVal
    end()
    return value
end()

print("clamp(5, 0, 10) = " + clamp(5, 0, 10))
print("clamp(-3, 0, 10) = " + clamp(-3, 0, 10))
print("clamp(15, 0, 10) = " + clamp(15, 0, 10))

// Higher order function usage
func applyTwice(fn, x):
    return fn(fn(x))
end()

func double(n):
    return calculate(n * 2)
end()

func addTen(n):
    return calculate(n + 10)
end()

print("applyTwice(double, 3) = " + applyTwice(double, 3))
print("applyTwice(addTen, 5) = " + applyTwice(addTen, 5))

// Try/catch error handling
func safeDivide(a, b):
    if(b == 0):
        return "ERROR: division by zero"
    end()
    return calculate(a / b)
end()

print("safeDivide(10, 2) = " + safeDivide(10, 2))
print("safeDivide(5, 0) = " + safeDivide(5, 0))

// Array operations with functions
func sumArray(arr):
    const table total = 0
    for item in arr:
        add item in total
    end()
    return total
end()

func maxArray(arr):
    const table best = arr[0]
    for item in arr:
        if(item > best):
            change(best to(item))
        end()
    end()
    return best
end()

func minArray(arr):
    const table least = arr[0]
    for item in arr:
        if(item < least):
            change(least to(item))
        end()
    end()
    return least
end()

const table data = [42, 7, 93, 15, 88, 3, 56, 71]
print("Array: [42, 7, 93, 15, 88, 3, 56, 71]")
print("Sum = " + sumArray(data))
print("Max = " + maxArray(data))
print("Min = " + minArray(data))

// String operations
func reverseString(s):
    return s.split("").reverse().join("")
end()

func isPalindrome(s):
    const table rev = reverseString(s)
    return s == rev
end()

print("reverse('ThyScript') = " + reverseString("ThyScript"))
print("isPalindrome('racecar') = " + isPalindrome("racecar"))
print("isPalindrome('hello') = " + isPalindrome("hello"))

// Complex nested logic
func classify(n):
    if(n < 0):
        return "negative"
    end()
    if(n == 0):
        return "zero"
    end()
    if(calculate(n % 2) == 0):
        if(n > 100):
            return "large even"
        end()
        return "even"
    end()
    if(n > 100):
        return "large odd"
    end()
    return "odd"
end()

print("classify(-5) = " + classify(-5))
print("classify(0) = " + classify(0))
print("classify(4) = " + classify(4))
print("classify(7) = " + classify(7))
print("classify(200) = " + classify(200))
print("classify(201) = " + classify(201))

print("=== TEST 4 PASSED ===")
