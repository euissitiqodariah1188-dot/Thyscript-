// ═══════════════════════════════════════════════════════
//  TEST 1: Math & Arithmetic Operations
//  Menguji semua operasi matematika ThyScript
// ═══════════════════════════════════════════════════════

print("=== TEST 1: MATH & ARITHMETIC ===")

// Basic arithmetic
const table a = 100
const table b = 37
const table c = calculate(a + b)
print("100 + 37 = " + c)

const table d = calculate(a - b)
print("100 - 37 = " + d)

const table e = calculate(a * b)
print("100 * 37 = " + e)

const table f = calculate(a / b)
print("100 / 37 = " + f)

// Power
const table g = calculate(2 ** 10)
print("2^10 = " + g)

// Modulo
const table h = calculate(100 % 7)
print("100 mod 7 = " + h)

// Floating point
const table pi = 3.14159
const table radius = 5.0
const table area = calculate(pi * radius * radius)
print("Circle area r=5: " + area)

// Compound operations
const table result = calculate((a + b) * 2 - 10)
print("(100+37)*2-10 = " + result)

// Variable mutation with add
const table counter = 0
add 1 in counter
add 1 in counter
add 1 in counter
print("Counter after 3 adds: " + counter)

// Variable reassignment with change
const table x = 10
change(x to(99))
print("x after change to 99: " + x)

// Conditionals with math
const table score = 85
if(score >= 90):
    print("Grade: A")
elif(score >= 80):
    print("Grade: B")
elif(score >= 70):
    print("Grade: C")
else:
    print("Grade: D")
end()

// While loop with counter
const table n = 0
const table sum = 0
while(n < 5):
    add n in sum
    add 1 in n
end()
print("Sum 0+1+2+3+4 = " + sum)

// For loop
const table nums = [10, 20, 30, 40, 50]
const table total = 0
for num in nums:
    add num in total
end()
print("Sum of array [10,20,30,40,50] = " + total)

print("=== TEST 1 PASSED ===")
