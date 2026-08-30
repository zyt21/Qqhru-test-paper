/*------------------------------------------------------    
【程序改错】
--------------------------------------------------------

题目：下面给定程序的功能是：从键盘上输入一个字符串, 将该
      字符串升序排列后输出到文件test.txt中，然后从该文件
      读出字符串并显示出来。
      请改正程序中的错误，使程序能得到正确的运行结果。

--------------------------------------------------------
注意：不可以增加或删除程序行，也不可以更改程序的结构。
------------------------------------------------------*/

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

main()
{
/**********FOUND**********/
 FILE  *fp;
 char t,str[100],str1[100];    
 int n,i,j;
 if((fp=fopen("test.txt","w"))==NULL)
   { printf("can't open this file.\n");exit(0);}
 printf("input a string:\n"); gets(str);
 n=strlen(str);
 for(i=0; i<n ;i++)
    for(j=0;j<n-i-1;j++)
        if(str[j]>str[j+1])
        { t=str[j];str[j]=str[j+1];str[j+1]=t; }
/**********FOUND**********/
 fputs(str,fp);
/**********FOUND**********/
 fclose(fp);
 /**********FOUND**********/
 fp=fopen("test.txt","r");
 fgets(str1,100,fp);
 printf("%s\n",str1);
 fclose(fp);    
}
